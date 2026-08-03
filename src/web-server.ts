import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, isAbsolute, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { getTicketByKey, listTickets, deleteTicket, upsertTicket } from "./db/tickets.js";
import { getLatestRunForTicket } from "./db/runs.js";
import { listArtifactsForRun } from "./db/run-artifacts.js";
import { getInstanceSettings, completeFirstRun } from "./db/settings.js";
import { getLatestReadinessScan } from "./db/readiness-scans.js";
import { purgeAllData } from "./db/purge.js";
import { getUserById } from "./db/users.js";
import { authenticateRequest } from "./auth/middleware.js";
import {
  AuthError,
  type AuthResult,
  login,
  logout,
  register,
  setupRequired,
} from "./auth/service.js";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "./auth/cookie.js";
import {
  loadPipelineConfig,
  DEFAULT_ENGINE_MODE,
  DEFAULT_IMPLEMENT_TIMEOUT_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  DEFAULT_SCAN_TIMEOUT_MS,
  DEFAULT_WORKTREE_ROOT,
  DEFAULT_BRANCH_PREFIX,
} from "./pipeline/config.js";
import type { PipelineConfig } from "./pipeline/config.js";
import { runPipeline } from "./pipeline/run.js";
import { runReadinessScan } from "./pipeline/readiness-scan.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";

/** Request bodies here are all small JSON payloads; anything larger is an unbounded-memory vector. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * API paths reachable without a session. Everything else under /api/ is
 * default-deny — see the guard in the request handler. This covers every
 * route the pipeline/settings/tickets work added (create, artifacts,
 * settings, run/stop/duplicate/delete), not just the original ticket list —
 * none of those had any auth on them before this branch merged, since they
 * were built before Auth existed.
 */
const PUBLIC_API_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
]);

/**
 * Extra Host header values to accept, for operators fronting this with a
 * reverse proxy on a real domain. Comma-separated, e.g.
 * `TRUSTED_HOSTS=pipeline.example.com,pipeline.internal:8443`.
 */
function parseTrustedHosts(): Set<string> {
  return new Set(
    (process.env.TRUSTED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0),
  );
}

/**
 * DNS-rebinding guard. A hostile page can point a domain it controls at
 * 127.0.0.1 and have the victim's browser make same-origin requests to this
 * server. Pinning the Host header to loopback (or an explicit allowlist)
 * makes those requests identifiable and rejectable.
 */
function isTrustedHost(hostHeader: string | undefined, boundPort: number, trusted: Set<string>): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  if (trusted.has(host)) return true;

  const loopback = ["127.0.0.1", "localhost", "[::1]"];
  if (loopback.some((name) => host === `${name}:${String(boundPort)}`)) return true;
  // Browsers omit the port from Host when it's the scheme default.
  if ((boundPort === 80 || boundPort === 443) && loopback.includes(host)) return true;
  return false;
}

/**
 * CSRF guard for state-changing requests.
 *
 * The design's "SameSite=Lax means no CSRF tokens needed" reasoning only
 * covers routes that *check* a cookie. POST /api/auth/register checks no
 * cookie — its only precondition is "no user exists yet" — so any cross-site
 * page could claim the account before the real operator does (and password
 * reset is out of scope, so that lockout is permanent). The same reasoning
 * applies to every other state-changing route the pipeline/settings/tickets
 * work added, which is why this guard runs globally rather than per-route —
 * it replaces those routes' original ad-hoc, Origin-only, no-Host-check
 * `isCrossOriginRequest` helper.
 *
 * Browsers always send Origin on cross-origin requests, and omit it on some
 * same-origin ones, so a *missing* Origin is treated as same-origin/trusted
 * and only a *mismatching* Origin is rejected.
 */
function originMatchesHost(originHeader: string, hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  let originHost: string;
  try {
    // `null` (opaque origin, e.g. a sandboxed iframe) fails to parse -> rejected.
    originHost = new URL(originHeader).host;
  } catch {
    return false;
  }
  // Compare host:port only, not scheme — a TLS-terminating reverse proxy
  // legitimately forwards `Origin: https://…` alongside a bare Host.
  return originHost.toLowerCase() === hostHeader.toLowerCase();
}

export interface WebServerOptions {
  dbPath: string;
  port: number;
  webRoot: string;
  /**
   * Path to the Pipeline shape instance config (src/pipeline/config.ts).
   * If it doesn't exist, the server still starts — POST .../run just
   * responds 503 until a real config/instance.json is created (copy
   * config/instance.example.json and point repoPath at a real project).
   */
  pipelineConfigPath: string;
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

/** Sends the right status for a caught error: AuthError's own status, or a logged 500. */
function sendCaughtError(res: ServerResponse, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    sendJson(res, err.status, { error: err.message });
    return;
  }
  console.error(`${context} failed:`, err);
  sendJson(res, 500, { error: "internal error" });
}

/**
 * `decodeURIComponent` throws `URIError` on malformed percent-encoding
 * (e.g. `/api/tickets/%E0%A4%A/artifacts`). Inside the request listener an
 * uncaught throw kills the whole process — including any in-flight
 * runPipeline call, orphaning a real agent subprocess — so every call site
 * goes through this and answers 400 instead.
 */
function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const onData = (chunk: Buffer): void => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        // Drop what we buffered and switch to flowing-drain mode: memory stays
        // bounded, but the socket stays readable so the 413 actually reaches
        // the client instead of being lost to an abrupt destroy().
        chunks.length = 0;
        req.removeListener("data", onData);
        req.resume();
        reject(new AuthError(413, "request body too large"));
        return;
      }
      chunks.push(chunk);
    };

    req.on("data", onData);
    req.on("end", () => {
      if (settled) return;
      settled = true;
      // Concat then decode once — decoding per chunk can split a multi-byte
      // UTF-8 sequence across a chunk boundary and corrupt the JSON.
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new AuthError(400, "invalid JSON body"));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function handleAuthRequest(res: ServerResponse, run: () => Promise<AuthResult>): void {
  run()
    .then((result) => {
      sendJson(
        res,
        200,
        { user: result.user },
        { "set-cookie": buildSessionCookie(result.session.token, COOKIE_SECURE) },
      );
    })
    .catch((err: unknown) => sendCaughtError(res, err, "auth request"));
}

/**
 * Validates a human-supplied project folder before storing it as the
 * first-run repo path: must be an absolute path, must exist, must be a
 * directory, and must actually be a git repo (has a .git entry) — a
 * pipeline run against a non-repo directory would fail confusingly deep
 * inside git.ts instead of here, at the point the human chose it.
 */
function validateRepoPath(candidate: unknown): { ok: true; repoPath: string } | { ok: false; error: string } {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return { ok: false, error: "repoPath is required" };
  }
  const repoPath = candidate.trim();
  if (!isAbsolute(repoPath)) {
    return { ok: false, error: "repoPath must be an absolute path" };
  }
  if (!existsSync(repoPath)) {
    return { ok: false, error: `no such directory: ${repoPath}` };
  }
  if (!statSync(repoPath).isDirectory()) {
    return { ok: false, error: `not a directory: ${repoPath}` };
  }
  if (!existsSync(join(repoPath, ".git"))) {
    return { ok: false, error: `not a git repository (no .git found in ${repoPath})` };
  }
  return { ok: true, repoPath };
}

/** First available key of the form "<base>", "<base>-copy", "<base>-copy-2", ... */
function uniqueTicketKey(db: import("better-sqlite3").Database, base: string): string {
  if (!getTicketByKey(db, base)) return base;
  let suffix = 2;
  let candidate = `${base}-copy`;
  while (getTicketByKey(db, candidate)) {
    candidate = `${base}-copy-${String(suffix)}`;
    suffix += 1;
  }
  return candidate;
}

/** The repo's currently checked-out branch — used as a baseBranch fallback
 * when there's no static config file to say otherwise, since a hardcoded
 * "main"/"master" guess would be wrong for plenty of real repos. */
function detectCurrentBranch(repoPath: string): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoPath, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Builds the config runPipeline actually runs with for one request. The
 * DB-stored repoPath (first-run setup, see instance_settings) always wins
 * over the static config file's repoPath — the file's repoPath is only a
 * dev-time fallback. The other fields (worktreeRoot, branchPrefix,
 * engineMode, timeouts) come from the static file when one exists; when it
 * doesn't, this instance still runs on sensible defaults rather than
 * refusing outright, since repoPath (set via Settings > Project) is the one
 * piece of setup this product actually asks a human to do up front.
 */
function resolveEffectiveConfig(
  fileConfig: PipelineConfig | null,
  dbRepoPath: string | null,
): PipelineConfig | null {
  const repoPath = dbRepoPath ?? fileConfig?.repoPath ?? null;
  if (!repoPath) return null;

  if (fileConfig) {
    return { ...fileConfig, repoPath };
  }

  return {
    repoPath,
    // Must be absolute: git resolves createWorktree's relative path against
    // repoPath (its own cwd for the `git worktree add` call), while the
    // engine invoker's cwd option resolves relative to *this server
    // process's* cwd — those two disagree on a bare relative string, so the
    // worktree git actually creates and the directory the agent tries to
    // start in silently diverge, and the agent exits instantly with no
    // output. Joining against repoPath up front removes the ambiguity.
    worktreeRoot: join(repoPath, DEFAULT_WORKTREE_ROOT),
    branchPrefix: DEFAULT_BRANCH_PREFIX,
    baseBranch: detectCurrentBranch(repoPath) ?? "main",
    engineMode: DEFAULT_ENGINE_MODE,
    implementTimeoutMs: DEFAULT_IMPLEMENT_TIMEOUT_MS,
    verifyTimeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
    scanTimeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
  };
}

/**
 * Minimal API + static server for the new (post-reset) product design.
 * Deliberately separate from server.ts, which serves the prior attempt's
 * job/lane model — this one knows about tickets, runs, auth, and the
 * pipeline trigger.
 */
export function startWebServer(options: WebServerOptions): Server {
  const { dbPath, port, webRoot, pipelineConfigPath } = options;
  const db = openDb(dbPath);

  const trustedHosts = parseTrustedHosts();
  // Set once the server is listening; `port` may be 0 ("pick a free port").
  let boundPort = port;

  const pipelineConfig = existsSync(pipelineConfigPath)
    ? loadPipelineConfig(pipelineConfigPath)
    : null;
  if (!pipelineConfig) {
    console.log(
      `Pipeline: no config at ${pipelineConfigPath} — POST /api/tickets/:key/run will return 503 until one exists (copy config/instance.example.json).`,
    );
  }

  // Global (process-wide) single-run guard: every run costs real money and
  // spawns a real coding agent, so at most one runPipeline call is ever in
  // flight, whichever ticket it's for. Not a real queue — sequential
  // execution across a backlog is still an unbuilt piece; this just refuses
  // the second trigger instead of racing it. The controller lets a human
  // stop that one in-flight run early from the UI.
  let runningTicketKey: string | null = null;
  let runningController: AbortController | null = null;
  // A readiness scan needs the same real shell access to the repo (via a
  // worktree) that a ticket run does, so it shares the same "only one thing
  // running at a time" rule rather than getting its own independent guard.
  let scanRunning = false;

  const server = createServer((req, res) => {
    // One wrapper around the entire handler body. Any unexpected throw from
    // ANY route — a SQLITE_BUSY out of the DB layer, say, or an in-flight
    // runPipeline call's setup failing — becomes a logged 500 for that one
    // request instead of an uncaught exception that takes down the whole
    // process (orphaning any real agent subprocess it was tracking). Every
    // current and future route inherits this uniformly.
    void (async () => {
      try {
        const url = req.url ?? "/";
        const path = url.split("?")[0] ?? "/";
        const method = req.method ?? "GET";

        // --- Host / Origin guard (runs before any route-specific logic) ---
        if (!isTrustedHost(req.headers.host, boundPort, trustedHosts)) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        const isSafeMethod = method === "GET" || method === "HEAD";
        if (!isSafeMethod) {
          const origin = req.headers.origin;
          if (origin !== undefined && !originMatchesHost(origin, req.headers.host)) {
            sendJson(res, 403, { error: "forbidden" });
            return;
          }
        }

        // --- Default-deny for the API surface ---
        // Anything under /api/ that isn't an explicitly public auth route
        // needs a valid session, decided here rather than per-route, so a
        // future route added to this file cannot fail open by forgetting its
        // own check. This also guarantees an unknown /api/ path never falls
        // through to the SPA, and it's what brings the pipeline/settings/
        // tickets routes below under auth for the first time.
        const isApiPath = path === "/api" || path.startsWith("/api/");
        if (isApiPath && !PUBLIC_API_PATHS.has(path)) {
          if (!authenticateRequest(db, req)) {
            sendJson(res, 401, { error: "unauthorized" });
            return;
          }
        }

        if (method === "GET" && path === "/api/auth/me") {
          if (setupRequired(db)) {
            sendJson(res, 200, { state: "setup_required" });
            return;
          }
          const auth = authenticateRequest(db, req);
          if (!auth) {
            sendJson(res, 200, { state: "unauthenticated" });
            return;
          }
          const user = getUserById(db, auth.userId);
          sendJson(res, 200, { state: "authenticated", user: { username: user?.username ?? "" } });
          return;
        }

        if (method === "POST" && path === "/api/auth/register") {
          handleAuthRequest(res, async () => {
            const body = (await readJsonBody(req)) as {
              username?: string;
              email?: string;
              password?: string;
            };
            if (!body.username || !body.email || !body.password) {
              throw new AuthError(400, "username, email, and password are required");
            }
            return register(db, {
              username: body.username,
              email: body.email,
              password: body.password,
            });
          });
          return;
        }

        if (method === "POST" && path === "/api/auth/login") {
          handleAuthRequest(res, async () => {
            const body = (await readJsonBody(req)) as { username?: string; password?: string };
            if (!body.username || !body.password) {
              throw new AuthError(400, "username and password are required");
            }
            return login(db, { username: body.username, password: body.password });
          });
          return;
        }

        if (method === "POST" && path === "/api/auth/logout") {
          const cookies = parseCookies(req.headers.cookie);
          const token = cookies[SESSION_COOKIE_NAME];
          if (token) logout(db, token);
          res.writeHead(204, { "set-cookie": buildClearedSessionCookie(COOKIE_SECURE) });
          res.end();
          return;
        }

        if (method === "GET" && path === "/api/tickets") {
          // Auth already enforced by the default-deny guard above.
          const ticketsWithRuns = listTickets(db).map((ticket) => ({
            ...ticket,
            latestRun: getLatestRunForTicket(db, ticket.key),
          }));
          sendJson(res, 200, ticketsWithRuns);
          return;
        }

        if (path === "/api/tickets" && method === "POST") {
          let body: unknown;
          try {
            body = await readJsonBody(req);
          } catch (err) {
            sendCaughtError(res, err, "ticket create");
            return;
          }
          const input = body as Partial<{
            key: string;
            summary: string;
            description: string;
            url: string | null;
          }> | null;
          if (
            typeof input?.key !== "string" ||
            input.key.trim().length === 0 ||
            typeof input.summary !== "string" ||
            typeof input.description !== "string"
          ) {
            sendJson(res, 400, { error: "key, summary, and description are required strings" });
            return;
          }
          const ticket = upsertTicket(db, {
            key: uniqueTicketKey(db, input.key.trim()),
            summary: input.summary,
            description: input.description,
            url: input.url ?? null,
          });
          sendJson(res, 201, ticket);
          return;
        }

        const artifactsMatch =
          method === "GET" ? /^\/api\/tickets\/([^/]+)\/artifacts$/.exec(path) : null;
        if (artifactsMatch) {
          const ticketKey = decodePathSegment(artifactsMatch[1] as string);
          if (ticketKey === null) {
            sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
            return;
          }
          const run = getLatestRunForTicket(db, ticketKey);
          sendJson(res, 200, run ? listArtifactsForRun(db, run.id) : []);
          return;
        }

        if (path === "/api/settings/project" && method === "GET") {
          sendJson(res, 200, getInstanceSettings(db));
          return;
        }

        if (path === "/api/settings/project" && method === "POST") {
          let body: unknown;
          try {
            body = await readJsonBody(req);
          } catch (err) {
            sendCaughtError(res, err, "settings update");
            return;
          }
          const candidate = (body as Record<string, unknown> | null)?.["repoPath"];
          const validated = validateRepoPath(candidate);
          if (!validated.ok) {
            sendJson(res, 400, { error: validated.error });
            return;
          }
          const settings = completeFirstRun(db, validated.repoPath, new Date().toISOString());
          sendJson(res, 200, settings);
          return;
        }

        // TEMPORARY dev-only route — see src/db/purge.ts.
        if (method === "POST" && path === "/api/dev/purge") {
          if (runningTicketKey !== null || scanRunning) {
            sendJson(res, 409, { error: "a run or scan is in flight — stop it before purging" });
            return;
          }
          purgeAllData(db);
          sendJson(res, 200, { status: "purged" });
          return;
        }

        if (method === "GET" && path === "/api/readiness-scans/latest") {
          sendJson(res, 200, getLatestReadinessScan(db));
          return;
        }

        if (method === "POST" && path === "/api/readiness-scans/run") {
          const effectiveConfig = resolveEffectiveConfig(pipelineConfig, getInstanceSettings(db).repoPath);
          if (!effectiveConfig) {
            sendJson(res, 503, {
              error: "no project folder configured yet — set one in Settings",
            });
            return;
          }
          if (runningTicketKey !== null || scanRunning) {
            sendJson(res, 409, {
              error:
                runningTicketKey !== null
                  ? `a ticket run (${runningTicketKey}) is already in flight — only one runs at a time`
                  : "a readiness scan is already running",
            });
            return;
          }

          scanRunning = true;
          runReadinessScan(effectiveConfig, db)
            .catch((err: unknown) => {
              console.error("Readiness scan failed:", err);
            })
            .finally(() => {
              scanRunning = false;
            });

          sendJson(res, 202, { status: "started" });
          return;
        }

        const runMatch = method === "POST" ? /^\/api\/tickets\/([^/]+)\/run$/.exec(path) : null;
        if (runMatch) {
          const ticketKey = decodePathSegment(runMatch[1] as string);
          if (ticketKey === null) {
            sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
            return;
          }

          // Cross-origin/DNS-rebinding already refused above, and this route
          // now also requires a valid session via the default-deny guard —
          // the ad-hoc Origin-only check this route used before Auth existed
          // is superseded rather than duplicated here.
          const effectiveConfig = resolveEffectiveConfig(pipelineConfig, getInstanceSettings(db).repoPath);
          if (!effectiveConfig) {
            sendJson(res, 503, {
              error: "no project folder configured yet — set one in Settings",
            });
            return;
          }
          if (!getTicketByKey(db, ticketKey)) {
            sendJson(res, 404, { error: `no ticket found with key "${ticketKey}"` });
            return;
          }
          if (runningTicketKey !== null || scanRunning) {
            sendJson(res, 409, {
              error:
                runningTicketKey === ticketKey
                  ? `${ticketKey} is already running`
                  : scanRunning
                    ? "a readiness scan is already in flight — only one runs at a time"
                    : `another run (${runningTicketKey}) is already in flight — only one runs at a time`,
            });
            return;
          }

          const controller = new AbortController();
          runningTicketKey = ticketKey;
          runningController = controller;
          runPipeline(ticketKey, effectiveConfig, db, undefined, controller.signal)
            .catch((err: unknown) => {
              console.error(`Pipeline run for ${ticketKey} failed:`, err);
            })
            .finally(() => {
              runningTicketKey = null;
              runningController = null;
            });

          sendJson(res, 202, { status: "started", ticketKey });
          return;
        }

        const stopMatch = method === "POST" ? /^\/api\/tickets\/([^/]+)\/stop$/.exec(path) : null;
        if (stopMatch) {
          const ticketKey = decodePathSegment(stopMatch[1] as string);
          if (ticketKey === null) {
            sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
            return;
          }
          if (runningTicketKey !== ticketKey || !runningController) {
            sendJson(res, 409, { error: `${ticketKey} is not currently running` });
            return;
          }
          runningController.abort();
          sendJson(res, 200, { status: "stopping", ticketKey });
          return;
        }

        const duplicateMatch =
          method === "POST" ? /^\/api\/tickets\/([^/]+)\/duplicate$/.exec(path) : null;
        if (duplicateMatch) {
          const ticketKey = decodePathSegment(duplicateMatch[1] as string);
          if (ticketKey === null) {
            sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
            return;
          }
          const original = getTicketByKey(db, ticketKey);
          if (!original) {
            sendJson(res, 404, { error: `no ticket found with key "${ticketKey}"` });
            return;
          }
          const duplicate = upsertTicket(db, {
            key: uniqueTicketKey(db, original.key),
            summary: original.summary,
            description: original.description,
            url: original.url,
          });
          sendJson(res, 201, duplicate);
          return;
        }

        const ticketMatch = /^\/api\/tickets\/([^/]+)$/.exec(path);
        if (ticketMatch && method === "DELETE") {
          const ticketKey = decodePathSegment(ticketMatch[1] as string);
          if (ticketKey === null) {
            sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
            return;
          }
          if (!getTicketByKey(db, ticketKey)) {
            sendJson(res, 404, { error: `no ticket found with key "${ticketKey}"` });
            return;
          }
          if (runningTicketKey === ticketKey) {
            sendJson(res, 409, { error: `${ticketKey} is currently running — stop it first` });
            return;
          }
          deleteTicket(db, ticketKey);
          sendJson(res, 200, { status: "deleted", ticketKey });
          return;
        }

        // Never let an /api/ path reach the SPA fallback: a typo'd or unknown
        // API path must 404 as JSON, not silently return index.html with a 200.
        if (!isApiPath && method === "GET" && serveStatic(path, webRoot, res)) return;

        sendJson(res, 404, { error: "not found" });
      } catch (err) {
        console.error("unhandled request error:", err);
        if (res.headersSent) {
          // Too late to write a status line; drop the connection rather than
          // leave the client hanging on a half-written response.
          res.destroy();
        } else {
          sendJson(res, 500, { error: "internal error" });
        }
      }
    })();
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    boundPort = typeof address === "object" && address ? address.port : port;
    console.log(`Server : http://127.0.0.1:${String(boundPort)}`);
    console.log(`DB     : ${dbPath}`);
    console.log(
      existsSync(join(webRoot, "index.html"))
        ? `Web    : ${webRoot}/index.html`
        : `Web    : not found at ${webRoot} — API only.`,
    );
  });

  return server;
}

function serveStatic(urlPath: string, webRoot: string, res: ServerResponse): boolean {
  if (!existsSync(webRoot)) return false;

  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const target = resolve(webRoot, normalize(relative));
  if (!target.startsWith(resolve(webRoot))) return false;

  const file = existsSync(target) && !target.endsWith("/") ? target : join(webRoot, "index.html");
  if (!existsSync(file)) return false;

  const body = readFileSync(file);
  res.writeHead(200, {
    "content-type": MIME[extname(file)] ?? "application/octet-stream",
    "content-length": body.length,
  });
  res.end(body);
  return true;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  startWebServer({
    dbPath: process.env.DB_PATH ?? "data/instance.sqlite",
    port: process.env.PORT ? Number(process.env.PORT) : 4319,
    webRoot: process.env.WEB_ROOT ?? "web/dist",
    pipelineConfigPath: process.env.PIPELINE_CONFIG_PATH ?? "config/instance.json",
  });
}
