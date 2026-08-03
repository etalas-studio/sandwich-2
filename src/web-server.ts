import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { listTickets } from "./db/tickets.js";
import { getLatestRunForTicket } from "./db/runs.js";
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

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";

export interface WebServerOptions {
  dbPath: string;
  port: number;
  webRoot: string;
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

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new AuthError(400, "invalid JSON body"));
      }
    });
    req.on("error", reject);
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
    .catch((err: unknown) => {
      if (err instanceof AuthError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        console.error("auth request failed:", err);
        sendJson(res, 500, { error: "internal error" });
      }
    });
}

/**
 * Minimal API + static server for the new (post-reset) product design.
 * Deliberately separate from server.ts, which serves the prior attempt's
 * job/lane model — this one only knows about tickets, runs, and auth so far.
 */
export function startWebServer(options: WebServerOptions): Server {
  const { dbPath, port, webRoot } = options;
  const db = openDb(dbPath);

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";

    if (req.method === "GET" && path === "/api/auth/me") {
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

    if (req.method === "POST" && path === "/api/auth/register") {
      handleAuthRequest(res, async () => {
        const body = (await readJsonBody(req)) as {
          username?: string;
          email?: string;
          password?: string;
        };
        if (!body.username || !body.email || !body.password) {
          throw new AuthError(400, "username, email, and password are required");
        }
        return register(db, { username: body.username, email: body.email, password: body.password });
      });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/login") {
      handleAuthRequest(res, async () => {
        const body = (await readJsonBody(req)) as { username?: string; password?: string };
        if (!body.username || !body.password) {
          throw new AuthError(400, "username and password are required");
        }
        return login(db, { username: body.username, password: body.password });
      });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/logout") {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE_NAME];
      if (token) logout(db, token);
      res.writeHead(204, { "set-cookie": buildClearedSessionCookie(COOKIE_SECURE) });
      res.end();
      return;
    }

    if (req.method === "GET" && path === "/api/tickets") {
      const auth = authenticateRequest(db, req);
      if (!auth) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }
      const ticketsWithRuns = listTickets(db).map((ticket) => ({
        ...ticket,
        latestRun: getLatestRunForTicket(db, ticket.key),
      }));
      sendJson(res, 200, ticketsWithRuns);
      return;
    }

    if (req.method === "GET" && serveStatic(path, webRoot, res)) return;

    sendJson(res, 404, { error: "not found" });
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
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
  });
}
