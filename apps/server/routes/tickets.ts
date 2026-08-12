import type { Router } from "../router.js";
import {
  createTicket,
  listTickets,
  updateTicket,
  deleteTicket,
  getTicket,
} from "../db/tickets.js";
import type { CreateTicketInput, UpdateTicketInput } from "../db/tickets.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import type { Database } from "../db/connection.js";
import { authenticateRequest } from "../auth/middleware.js";
import { incrementUsage } from "../db/repo/usage.js";

export function registerTicketRoutes(router: Router, db: Database): void {
  router.post("/api/tickets", async (req, res) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
      return;
    }

    const candidate = body as Record<string, unknown> | null;
    if (!candidate || typeof candidate !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const summary =
      typeof candidate.summary === "string" && candidate.summary.trim() !== ""
        ? candidate.summary.trim()
        : undefined;
    const description =
      typeof candidate.description === "string" ? candidate.description.trim() : "";
    const url =
      typeof candidate.url === "string" && candidate.url.trim() !== ""
        ? candidate.url.trim()
        : null;

    if (!description) {
      sendJson(res, 400, { error: "description is required" });
      return;
    }

    const input: CreateTicketInput = { id, summary, description, url };

    try {
      const ticket = await createTicket(db, input);
      // Track usage
      const auth = await authenticateRequest(db, req);
      if (auth) await incrementUsage(db, auth.userId);
      sendJson(res, 201, ticket);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
    }
  });

  router.get("/api/tickets", async (_req, res) => {
    sendJson(res, 200, await listTickets(db));
  });

  router.get("/api/tickets/:key", async (_req, res, params) => {
    const ticket = await getTicket(db, params.key!);
    if (!ticket) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    sendJson(res, 200, ticket);
  });

  router.put("/api/tickets/:key", async (req, res, params) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "ticket update");
      return;
    }

    const candidate = body as Record<string, unknown> | null;
    if (!candidate || typeof candidate !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const input: UpdateTicketInput = {};
    if (typeof candidate.summary === "string") input.summary = candidate.summary.trim() || null;
    if (typeof candidate.description === "string")
      input.description = candidate.description.trim();
    if (typeof candidate.url === "string") input.url = candidate.url.trim() || null;
    if (typeof candidate.status === "string") input.status = candidate.status;

    const ticket = await updateTicket(db, params.key!, input);
    if (!ticket) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    sendJson(res, 200, ticket);
  });

  router.delete("/api/tickets/:key", async (_req, res, params) => {
    const deleted = await deleteTicket(db, params.key!);
    if (!deleted) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    sendJson(res, 200, { deleted: true });
  });
}
