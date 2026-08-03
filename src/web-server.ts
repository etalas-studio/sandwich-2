import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, isAbsolute, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { getTicketByKey, listTickets } from "./db/tickets.js";
import { getLatestRunForTicket } from "./db/runs.js";
import { listArtifactsForRun } from "./db/run-artifacts.js";
import { getInstanceSettings, completeFirstRun } from "./db/settings.js";
import {
  loadPipelineConfig,
  DEFAULT_ENGINE_MODE,
  DEFAULT_IMPLEMENT_TIMEOUT_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  DEFAULT_WORKTREE_ROOT,
  DEFAULT_BRANCH_PREFIX,
} from "./pipeline/config.js";
import type { PipelineConfig } from "./pipeline/config.js";
import { runPipeline } from "./pipeline/run.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
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

/**
 * Browser-CSRF defense for the state-changing run trigger: there's no auth
 * on this instance yet (Auth is its own unplanned roadmap piece), so the
 * least we can do is refuse cross-origin browser requests. An absent
 * `Origin` header is allowed — same-origin navigations and non-browser
 * clients (curl, the test suite) typically don't send one, and this is not
 * a substitute for real authentication.
 */
function isCrossOriginRequest(origin: string | undefined, host: string | undefined): boolean {
  if (origin === undefined || origin === "") return false;
  if (host === undefined || host === "") return true;
  return origin !== `http://${host}` && origin !== `https://${host}`;
}

const MAX_JSON_BODY_BYTES = 64 * 1024;

/** Reads and JSON-parses a request body, capped to avoid an unbounded read. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = "";
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      data += chunk.toString("utf8");
      if (data.length > MAX_JSON_BODY_BYTES) {
        tooLarge = true;
        rejectPromise(new Error("request body too large"));
      }
    });
    req.on("end", () => {
      if (tooLarge) return;
      try {
        resolvePromise(data.length === 0 ? {} : JSON.parse(data));
      } catch {
        rejectPromise(new Error("request body is not valid JSON"));
      }
    });
    req.on("error", rejectPromise);
  });
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
  };
}

/**
 * Minimal API + static server for the new (post-reset) product design.
 * Deliberately separate from server.ts, which serves the prior attempt's
 * job/lane model — this one only knows about tickets and runs so far.
 */
export function startWebServer(options: WebServerOptions): void {
  const { dbPath, port, webRoot, pipelineConfigPath } = options;
  const db = openDb(dbPath);

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
  // the second trigger instead of racing it.
  let runningTicketKey: string | null = null;

  const server = createServer((req, res) => {
    void (async () => {
    try {
      const url = req.url ?? "/";
      const path = url.split("?")[0] ?? "/";

      if (req.method === "GET" && path === "/api/tickets") {
        const ticketsWithRuns = listTickets(db).map((ticket) => ({
          ...ticket,
          latestRun: getLatestRunForTicket(db, ticket.key),
        }));
        sendJson(res, 200, ticketsWithRuns);
        return;
      }

      const artifactsMatch =
        req.method === "GET" ? /^\/api\/tickets\/([^/]+)\/artifacts$/.exec(path) : null;
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

      if (path === "/api/settings/project" && req.method === "GET") {
        sendJson(res, 200, getInstanceSettings(db));
        return;
      }

      if (path === "/api/settings/project" && req.method === "POST") {
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          sendJson(res, 400, { error: (err as Error).message });
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

      const runMatch = req.method === "POST" ? /^\/api\/tickets\/([^/]+)\/run$/.exec(path) : null;
      if (runMatch) {
        const ticketKey = decodePathSegment(runMatch[1] as string);
        if (ticketKey === null) {
          sendJson(res, 400, { error: "malformed percent-encoding in ticket key" });
          return;
        }

        if (isCrossOriginRequest(req.headers.origin, req.headers.host)) {
          sendJson(res, 403, { error: "cross-origin run requests are refused" });
          return;
        }
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
        if (runningTicketKey !== null) {
          sendJson(res, 409, {
            error:
              runningTicketKey === ticketKey
                ? `${ticketKey} is already running`
                : `another run (${runningTicketKey}) is already in flight — only one runs at a time`,
          });
          return;
        }

        runningTicketKey = ticketKey;
        runPipeline(ticketKey, effectiveConfig, db)
          .catch((err: unknown) => {
            console.error(`Pipeline run for ${ticketKey} failed:`, err);
          })
          .finally(() => {
            runningTicketKey = null;
          });

        sendJson(res, 202, { status: "started", ticketKey });
        return;
      }

      if (req.method === "GET" && serveStatic(path, webRoot, res)) return;

      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not found" }));
    } catch (err) {
      // Backstop so one bad request can never take the process down with an
      // in-flight pipeline run attached to it.
      console.error(`Unhandled error serving ${req.method ?? "?"} ${req.url ?? "?"}:`, err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal server error" });
      } else {
        res.end();
      }
    }
    })();
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Server : http://127.0.0.1:${String(port)}`);
    console.log(`DB     : ${dbPath}`);
    console.log(
      existsSync(join(webRoot, "index.html"))
        ? `Web    : ${webRoot}/index.html`
        : `Web    : not found at ${webRoot} — API only.`,
    );
  });
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
