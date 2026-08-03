import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { getInstanceSettings, completeFirstRun } from "./db/settings.js";
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
  MIME,
  sendJson,
  sendCaughtError,
  decodePathSegment,
  readJsonBody,
  validateRepoPath,
} from "./http-utils.js";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "./auth/cookie.js";
import {
  initIntegrations,
  getIntegrationStatus,
  connectWithApiKey,
  disconnectApiKey,
} from "./pipeline/integrations.js";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";

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
 * Minimal API + static server. Serves auth, settings, integrations, and
 * the SPA — the ticket pipeline has been removed (UI is static mock data).
 */
export function startWebServer(options: WebServerOptions): Server {
  const { dbPath, port, webRoot } = options;
  const db = openDb(dbPath);

  const trustedHosts = parseTrustedHosts();
  // Set once the server is listening; `port` may be 0 ("pick a free port").
  let boundPort = port;

  // Pi SDK integration layer — loads custom providers from config/models.json.
  initIntegrations(db).catch((err) => {
    console.error("Integrations init failed:", err);
  });

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

        // --- Integrations (Pi SDK provider management) ---
        if (method === "GET" && path === "/api/integrations") {
          try {
            const status = await getIntegrationStatus();
            sendJson(res, 200, status);
          } catch (err) {
            sendCaughtError(res, err, "integrations list");
          }
          return;
        }

        const connectMatch = method === "POST" ? /^\/api\/integrations\/(opencode-go)\/connect$/.exec(path) : null;
        if (connectMatch) {
          const providerId = connectMatch[1] as string;
          let body: unknown;
          try {
            body = await readJsonBody(req);
          } catch (err) {
            sendCaughtError(res, err, "integration connect");
            return;
          }
          const apiKey = (body as Record<string, unknown> | null)?.["apiKey"];
          if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
            sendJson(res, 400, { error: "apiKey is required" });
            return;
          }
          try {
            const result = await connectWithApiKey(providerId, apiKey.trim());
            sendJson(res, result.ok ? 200 : 400, result);
          } catch (err) {
            sendCaughtError(res, err, "integration connect");
          }
          return;
        }

        const disconnectMatch = method === "POST" ? /^\/api\/integrations\/(opencode-go)\/disconnect$/.exec(path) : null;
        if (disconnectMatch) {
          const providerId = disconnectMatch[1] as string;
          try {
            const result = await disconnectApiKey(providerId);
            sendJson(res, result.ok ? 200 : 400, result);
          } catch (err) {
            sendCaughtError(res, err, "integration disconnect");
          }
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
  });
}
