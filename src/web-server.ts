import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { listTickets } from "./db/tickets.js";

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
}

/**
 * Minimal API + static server for the new (post-reset) product design.
 * Deliberately separate from server.ts, which serves the prior attempt's
 * job/lane model — this one only knows about the tickets table so far.
 */
export function startWebServer(options: WebServerOptions): void {
  const { dbPath, port, webRoot } = options;
  const db = openDb(dbPath);

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";

    if (req.method === "GET" && path === "/api/tickets") {
      const payload = JSON.stringify(listTickets(db));
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload),
        "cache-control": "no-store",
      });
      res.end(payload);
      return;
    }

    if (req.method === "GET" && serveStatic(path, webRoot, res)) return;

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not found" }));
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
  });
}
