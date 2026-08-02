import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { JobQueue } from "./jobs.js";
import { computeMetrics } from "./dashboard.js";
import { laneLabel } from "./guardrails.js";
import { readArtifact } from "./record.js";
import type { Config, TicketInput } from "./types.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface ServeOptions {
  config: Config;
  configPath: string;
  queuePath: string;
  port: number;
  /** Folder hasil build frontend. Kalau tidak ada, hanya API yang aktif. */
  webRoot: string;
}

interface QueueFile {
  tickets: TicketInput[];
}

function loadQueueFile(path: string): QueueFile {
  if (!existsSync(path)) return { tickets: [] };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(parsed)) return { tickets: [] };
    return { tickets: parsed as TicketInput[] };
  } catch {
    return { tickets: [] };
  }
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

function readBody(req: IncomingMessage, limitBytes = 2_000_000): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("badan permintaan terlalu besar"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", (err) => reject(err));
  });
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function startServer(options: ServeOptions): void {
  const { config, queuePath, port, webRoot } = options;

  let queue = loadQueueFile(queuePath);
  const getTicket = (key: string): TicketInput | null =>
    queue.tickets.find((t) => t.key === key) ?? null;

  const jobs = new JobQueue(config, getTicket);
  const sseClients = new Set<ServerResponse>();

  jobs.subscribe((event, payload) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      client.write(frame);
    }
  });

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      sendJson(res, 500, { error: (err as Error).message });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://localhost:${String(port)}`);
    const path = url.pathname;
    const method = req.method ?? "GET";

    // ---- SSE: progress langsung ke browser ------------------------------
    if (path === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(": terhubung\n\n");
      sseClients.add(res);

      // Ping berkala supaya proxy atau browser tidak menutup koneksi diam.
      const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
      req.on("close", () => {
        clearInterval(ping);
        sseClients.delete(res);
      });
      return;
    }

    // ---- Keadaan awal untuk render pertama -------------------------------
    if (path === "/api/state" && method === "GET") {
      queue = loadQueueFile(queuePath);
      const runs = jobs.runs();
      sendJson(res, 200, {
        tickets: queue.tickets,
        runs,
        jobs: jobs.list(),
        metrics: computeMetrics(runs),
        config: {
          engine: config.engine.name,
          repoPath: config.repoPath,
          baseBranch: config.baseBranch,
          limits: config.limits,
          laneRules: config.laneRules,
          blocklistCount: config.blocklist.length,
        },
      });
      return;
    }

    if (path === "/api/config" && method === "GET") {
      sendJson(res, 200, {
        limits: config.limits,
        laneRules: config.laneRules,
        blocklist: config.blocklist,
        engine: config.engine.name,
        repoPath: config.repoPath,
        baseBranch: config.baseBranch,
        lanes: [1, 2, 3].map((n) => ({ lane: n, label: laneLabel(n as 1 | 2 | 3) })),
      });
      return;
    }

    // ---- Detail satu percobaan ------------------------------------------
    const detail = /^\/api\/runs\/([A-Za-z0-9-]+)\/([A-Za-z0-9:.-]+)$/.exec(path);
    if (detail && method === "GET") {
      const ticket = detail[1] as string;
      const runId = detail[2] as string;
      const record = jobs.runs().find((r) => r.ticket === ticket && r.runId === runId);
      if (!record) {
        sendJson(res, 404, { error: "percobaan tidak ditemukan" });
        return;
      }
      sendJson(res, 200, {
        record,
        plan: readArtifact(config.runsRoot, ticket, runId, "plan.md"),
        diff: readArtifact(config.runsRoot, ticket, runId, "diff.patch"),
        agentOutput: readArtifact(config.runsRoot, ticket, runId, "agent-output.md"),
        files: readArtifact(config.runsRoot, ticket, runId, "files.json"),
        toolCalls: readArtifact(config.runsRoot, ticket, runId, "tool-calls.json"),
      });
      return;
    }

    // ---- Mulai tahap rencana --------------------------------------------
    if (path === "/api/runs" && method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      const ticket = typeof body["ticket"] === "string" ? body["ticket"] : "";
      queue = loadQueueFile(queuePath);
      if (getTicket(ticket) === null) {
        sendJson(res, 400, { error: `tiket ${ticket} tidak ada di antrean` });
        return;
      }
      sendJson(res, 202, { job: jobs.enqueue("plan", ticket, null) });
      return;
    }

    // ---- Approve rencana -> lanjut implementasi --------------------------
    const approve = /^\/api\/runs\/([A-Za-z0-9-]+)\/([A-Za-z0-9:.-]+)\/approve$/.exec(path);
    if (approve && method === "POST") {
      const ticket = approve[1] as string;
      const runId = approve[2] as string;
      queue = loadQueueFile(queuePath);
      sendJson(res, 202, { job: jobs.enqueue("implement", ticket, runId) });
      return;
    }

    // ---- Tolak rencana ---------------------------------------------------
    const reject = /^\/api\/runs\/([A-Za-z0-9-]+)\/([A-Za-z0-9:.-]+)\/reject$/.exec(path);
    if (reject && method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      const reason = typeof body["reason"] === "string" ? body["reason"] : "";
      const record = await jobs.reject(reject[1] as string, reject[2] as string, reason);
      sendJson(res, 200, { record });
      return;
    }

    // ---- Simpan hasil review (tiga field manusia) ------------------------
    const review = /^\/api\/runs\/([A-Za-z0-9-]+)\/([A-Za-z0-9:.-]+)\/review$/.exec(path);
    if (review && method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      const record = jobs.saveReview(review[1] as string, review[2] as string, {
        humanEditedLines: numberOrNull(body["humanEditedLines"]),
        reviewRounds: numberOrNull(body["reviewRounds"]),
        merged: typeof body["merged"] === "boolean" ? body["merged"] : null,
        notes: typeof body["notes"] === "string" ? body["notes"] : null,
      });
      sendJson(res, 200, { record });
      return;
    }

    // ---- Ubah urutan antrean = ubah prioritas ---------------------------
    if (path === "/api/queue/reorder" && method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      const order = Array.isArray(body["order"]) ? (body["order"] as string[]) : [];
      queue = loadQueueFile(queuePath);

      const byKey = new Map(queue.tickets.map((t) => [t.key, t]));
      const reordered: TicketInput[] = [];
      for (const key of order) {
        const ticket = byKey.get(key);
        if (ticket) {
          reordered.push(ticket);
          byKey.delete(key);
        }
      }
      // Tiket yang tidak disebut di urutan baru ditaruh di belakang, jangan dibuang.
      reordered.push(...byKey.values());

      writeFileSync(queuePath, JSON.stringify(reordered, null, 2) + "\n", "utf8");
      queue = { tickets: reordered };
      sendJson(res, 200, { tickets: reordered });
      return;
    }

    // Endpoint /api/ yang tidak dikenal harus menjawab JSON, bukan halaman HTML.
    // Kalau tidak, salah ketik URL API terlihat seperti berhasil.
    if (path.startsWith("/api/")) {
      sendJson(res, 404, { error: `endpoint tidak dikenal: ${path}` });
      return;
    }

    if (method === "GET") {
      const served = serveStatic(path, webRoot, res);
      if (served) return;
    }

    sendJson(res, 404, { error: "tidak ditemukan" });
  }

  // Bind hanya ke localhost. UI ini bisa mengubah kode di repo klien —
  // jangan pernah dengarkan di 0.0.0.0.
  server.listen(port, "127.0.0.1", () => {
    console.log(`Server  : http://127.0.0.1:${String(port)}`);
    console.log(`Repo    : ${config.repoPath}`);
    console.log(`Antrean : ${queuePath} (${String(queue.tickets.length)} tiket)`);
    console.log(
      existsSync(join(webRoot, "index.html"))
        ? `Web     : ${webRoot}/index.html`
        : `Web     : tidak ditemukan di ${webRoot} — API tetap aktif.`,
    );
  });
}

function serveStatic(
  urlPath: string,
  webRoot: string,
  res: ServerResponse,
): boolean {
  if (!existsSync(webRoot)) return false;

  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const target = resolve(webRoot, normalize(relative));

  // Jangan pernah melayani file di luar webRoot.
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
