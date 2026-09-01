import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import type { DocumentType } from "../../documents/db.js";
import { closeInFlight } from "./generation.js";
import { deleteConversationSession } from "../../projects/sessions.js";
import {
  createConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  getConversation,
  type UpdateConversationInput,
} from "../../conversations/db.js";
import {
  listProjectsWithConversations,
  ProjectNotFoundError,
} from "../../projects/db.js";
import { sendCaughtErrorExpress } from "../../http-utils.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { getActiveSubscription } from "../../db/repo/subscriptions.js";

function parseUpdateInput(candidate: Record<string, unknown>): UpdateConversationInput {
  const input: UpdateConversationInput = {};
  if (typeof candidate.title === "string") input.title = candidate.title.trim();
  if (typeof candidate.prompt === "string") input.prompt = candidate.prompt.trim();
  if (candidate.feedback === null || typeof candidate.feedback === "string")
    input.feedback = candidate.feedback;
  if (typeof candidate.pinned === "boolean") input.pinned = candidate.pinned;
  if (typeof candidate.unread === "boolean") input.unread = candidate.unread;
  return input;
}

export function registerConversationRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.post("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "body must be a JSON object" });
      return;
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const rawPendingType = typeof body.pendingType === "string" ? body.pendingType : undefined;
    const pendingType: DocumentType | undefined =
      rawPendingType === "prd" || rawPendingType === "quotation" ||
      rawPendingType === "prototype" || rawPendingType === "specs"
        ? rawPendingType
        : undefined;
    const title =
      typeof body.title === "string" && body.title.trim() !== ""
        ? body.title.trim()
        : null;
    const prompt =
      typeof body.prompt === "string" && body.prompt.trim() !== ""
        ? body.prompt.trim()
        : null;
    const projectId =
      typeof body.projectId === "string" && body.projectId.trim() !== ""
        ? body.projectId.trim()
        : undefined;

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    if (!sub) {
      res.status(403).json({ error: "active subscription required" });
      return;
    }

    try {
      const conversation = await createConversation(db, auth.userId, {
        id: id || undefined,
        title: title ?? prompt!,
        prompt: prompt!,
        pendingType,
        projectId,
      });
      res.status(201).json(conversation);
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      sendCaughtErrorExpress(res, err, "conversation creation");
    }
  });

  router.get("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.query.groupBy === "project") {
      res.status(200).json(await listProjectsWithConversations(db, auth.userId));
      return;
    }
    res.status(200).json(await listConversations(db, auth.userId));
  });

  router.get("/api/conversations/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    res.status(200).json(conversation);
  });

  router.put("/api/conversations/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "body must be a JSON object" });
      return;
    }

    const updated = await updateConversation(db, req.params.id!, parseUpdateInput(body));
    res.status(200).json(updated);
  });

  router.patch("/api/conversations/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "body must be a JSON object" });
      return;
    }

    const updated = await updateConversation(db, req.params.id!, parseUpdateInput(body));
    res.status(200).json(updated);
  });

  router.delete("/api/conversations/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, req.params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    closeInFlight(req.params.id!);
    await deleteConversation(db, req.params.id!);
    deleteConversationSession(req.params.id!);
    res.status(204).end();
  });
}
