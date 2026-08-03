import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Router } from "../router.js";
import type { InvokerFactory } from "../scanner/run-scan.js";
import { getInstanceSettings } from "../db/settings.js";
import { getTicket, updateTicket } from "../db/tickets.js";
import { runTicketPipeline } from "../pipeline/ticket-runner.js";
import type { TicketRunEvent } from "../pipeline/ticket-runner.js";
import { sendJson } from "../http-utils.js";

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

export function registerTicketRunRoutes(
  router: Router,
  db: Database.Database,
  createInvoker: InvokerFactory,
): void {
  // Trigger a ticket pipeline run
  router.post("/api/tickets/:key/run", async (req, res, params) => {
    const settings = getInstanceSettings(db);
    if (!settings.repoPath) {
      sendJson(res, 503, { error: "No project configured." });
      return;
    }

    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    if (ticket.status === "done") {
      sendJson(res, 409, { error: "Ticket is already done" });
      return;
    }

    // Only one run per ticket at a time
    if (inFlight.has(ticketKey)) {
      sendJson(res, 409, { error: "A run is already in progress for this ticket" });
      return;
    }

    // Read optional modelId from body
    let modelId: string | null = null;
    try {
      const body = await readJson(req);
      if (body && typeof (body as Record<string, unknown>).modelId === "string") {
        modelId = (body as Record<string, unknown>).modelId as string;
      }
    } catch {
      // body is optional
    }

    const controller = new AbortController();
    inFlight.set(ticketKey, controller);

    const broadcast = (event: TicketRunEvent) => {
      const clients = sseClients.get(ticketKey);
      if (!clients) return;
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        try { client.write(data); } catch { clients.delete(client); }
      }
    };

    runTicketPipeline(db, createInvoker, ticketKey, settings.repoPath, modelId, broadcast, controller.signal)
      .catch(() => {})
      .finally(() => {
        inFlight.delete(ticketKey);
        // Close SSE connections
        const clients = sseClients.get(ticketKey);
        if (clients) {
          for (const client of clients) {
            try { client.end(); } catch { /* ignore */ }
          }
          sseClients.delete(ticketKey);
        }
      });

    sendJson(res, 200, { ticketKey, started: true });
  });

  // Resolve a quick-win choice and re-run
  router.post("/api/tickets/:key/resolve", async (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    if (!ticket.quickWinChoices) {
      sendJson(res, 400, { error: "No pending choices for this ticket" });
      return;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const choiceIndex = (body as Record<string, unknown> | null)?.["choiceIndex"];
    if (typeof choiceIndex !== "number") {
      sendJson(res, 400, { error: "choiceIndex is required" });
      return;
    }

    let choices: Array<{ label: string; description: string; inject: string }>;
    try {
      choices = JSON.parse(ticket.quickWinChoices);
    } catch {
      sendJson(res, 500, { error: "Invalid choices data" });
      return;
    }

    if (choiceIndex < 0 || choiceIndex >= choices.length) {
      sendJson(res, 400, { error: "Invalid choiceIndex" });
      return;
    }

    const chosen = choices[choiceIndex]!;
    const newDescription = `${ticket.description}\n\n[Resolved] ${chosen.inject}`;

    updateTicket(db, ticketKey, {
      description: newDescription,
      quickWinChoices: null,
      quickWinAttempts: (ticket.quickWinAttempts ?? 0) + 1,
      status: "backlog",
      stage: null,
      needsHumanCategory: null,
      needsHumanReason: null,
    });

    // Trigger re-run
    const settings = getInstanceSettings(db);
    if (!settings.repoPath) {
      sendJson(res, 200, { resolved: true, rerun: false, error: "No project configured" });
      return;
    }

    // Read optional modelId from body
    let modelId: string | null = null;
    if (typeof (body as Record<string, unknown>).modelId === "string") {
      modelId = (body as Record<string, unknown>).modelId as string;
    }

    if (inFlight.has(ticketKey)) {
      sendJson(res, 200, { resolved: true, rerun: false, error: "Run already in progress" });
      return;
    }

    const controller = new AbortController();
    inFlight.set(ticketKey, controller);

    const broadcast = (event: TicketRunEvent) => {
      const clients = sseClients.get(ticketKey);
      if (!clients) return;
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        try { client.write(data); } catch { clients.delete(client); }
      }
    };

    runTicketPipeline(db, createInvoker, ticketKey, settings.repoPath, modelId, broadcast, controller.signal)
      .catch(() => {})
      .finally(() => {
        inFlight.delete(ticketKey);
        const clients = sseClients.get(ticketKey);
        if (clients) {
          for (const client of clients) {
            try { client.end(); } catch { /* ignore */ }
          }
          sseClients.delete(ticketKey);
        }
      });

    sendJson(res, 200, { resolved: true, rerun: true });
  });

  // SSE stream for ticket progress
  router.get("/api/tickets/:key/stream", (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);

    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    // Send current state
    res.write(`data: ${JSON.stringify({ type: "current", ticket })}\n\n`);

    // Register client
    if (!sseClients.has(ticketKey)) {
      sseClients.set(ticketKey, new Set());
    }
    sseClients.get(ticketKey)!.add(res);

    // If no run in flight, close after sending current state
    if (!inFlight.has(ticketKey)) {
      res.write(`data: ${JSON.stringify({ type: "done", ticket })}\n\n`);
      res.end();
      sseClients.get(ticketKey)?.delete(res);
      return;
    }

    // Cleanup on disconnect
    req.on("close", () => {
      sseClients.get(ticketKey)?.delete(res);
      res.end();
    });
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}
