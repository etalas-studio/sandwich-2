import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { getTicketByKey, listTickets } from "./db/tickets.js";
import { getLatestRunForTicket } from "./db/runs.js";
import { loadPipelineConfig } from "./pipeline/config.js";
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

  // In-memory guard against double-triggering the same ticket while a run
  // is already in flight — not a real queue (sequential execution across
  // *all* tickets is still an unbuilt piece), just enough to keep one
  // click from racing itself.
  const runningTickets = new Set<string>();

  const server = createServer((req, res) => {
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

    const runMatch = req.method === "POST" ? /^\/api\/tickets\/([^/]+)\/run$/.exec(path) : null;
    if (runMatch) {
      const ticketKey = decodeURIComponent(runMatch[1] as string);

      if (!pipelineConfig) {
        sendJson(res, 503, { error: "no pipeline config — see server startup log" });
        return;
      }
      if (!getTicketByKey(db, ticketKey)) {
        sendJson(res, 404, { error: `no ticket found with key "${ticketKey}"` });
        return;
      }
      if (runningTickets.has(ticketKey)) {
        sendJson(res, 409, { error: `${ticketKey} is already running` });
        return;
      }

      runningTickets.add(ticketKey);
      runPipeline(ticketKey, pipelineConfig, db)
        .catch((err: unknown) => {
          console.error(`Pipeline run for ${ticketKey} failed:`, err);
        })
        .finally(() => {
          runningTickets.delete(ticketKey);
        });

      sendJson(res, 202, { status: "started", ticketKey });
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
    pipelineConfigPath: process.env.PIPELINE_CONFIG_PATH ?? "config/instance.json",
  });
}
