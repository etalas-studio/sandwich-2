import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { createTicket, listTickets } from "../db/tickets.js";
import type { CreateTicketInput } from "../db/tickets.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";

export function registerTicketRoutes(router: Router, db: Database.Database): void {
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
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const url = typeof candidate.url === "string" && candidate.url.trim() !== "" ? candidate.url.trim() : null;

    if (!description) {
      sendJson(res, 400, { error: "description is required" });
      return;
    }

    const input: CreateTicketInput = { id, description, url };

    try {
      const ticket = createTicket(db, input);
      sendJson(res, 201, ticket);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
    }
  });

  router.get("/api/tickets", (_req, res) => {
    sendJson(res, 200, listTickets(db));
  });
}
