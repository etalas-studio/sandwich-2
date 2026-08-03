import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { initIntegrations } from "./pipeline/integrations.js";
import { authenticateRequest } from "./auth/middleware.js";
import { MIME, sendJson } from "./http-utils.js";
import { Router } from "./router.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";

export interface WebServerOptions {
  dbPath: string;
  port: number;
  webRoot: string;
}

function parseTrustedHosts(): Set<string> {
  return new Set(
    (process.env.TRUSTED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
  );
}

const PUBLIC_API_PATHS = new Set(["/api/auth/me", "/api/auth/register", "/api/auth/login", "/api/auth/logout"]);

export function startWebServer(options: WebServerOptions): Server {
  const { dbPath, port, webRoot } = options;
  const db = openDb(dbPath);
  const trustedHosts = parseTrustedHosts();
  let boundPort = port;

  // Pi SDK integrations
  initIntegrations(db).catch((err) => {
    console.error("Integrations init failed:", err);
  });

  // Build router
  const router = new Router(trustedHosts, boundPort);

  // Auth middleware — session gate for non-public API paths
  router.use((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const isApiPath = path === "/api" || path.startsWith("/api/");
    if (isApiPath && !PUBLIC_API_PATHS.has(path)) {
      if (!authenticateRequest(db, req)) {
        sendJson(res, 401, { error: "unauthorized" });
        return false;
      }
    }
  });

  // Register route modules
  registerAuthRoutes(router, db, PUBLIC_API_PATHS);
  registerSettingsRoutes(router, db);
  registerIntegrationRoutes(router);

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? "/";
        const path = url.split("?")[0] ?? "/";
        if (path === "/api" || path.startsWith("/api/")) { await router.dispatch(req, res); return; }
        if ((req.method ?? "GET") === "GET" && serveStatic(path, webRoot, res)) return;
        sendJson(res, 404, { error: "not found" });
      } catch (err) {
        console.error("unhandled request error:", err);
        res.headersSent ? res.destroy() : sendJson(res, 500, { error: "internal error" });
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

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startWebServer({
    dbPath: process.env.DB_PATH ?? "data/instance.sqlite",
    port: process.env.PORT ? Number(process.env.PORT) : 4319,
    webRoot: process.env.WEB_ROOT ?? "web/dist",
  });
}
