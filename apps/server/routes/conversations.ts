import type { Router } from "../router.js";
import {
  createConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  getConversation,
  type UpdateConversationInput,
  type ConversationType,
} from "../db/conversations.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import type { Database } from "../db/connection.js";
import { authenticateRequest } from "../auth/middleware.js";
import { incrementUsage, getMonthlyUsage } from "../db/repo/usage.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { PLANS } from "../pipeline/plans.js";

function parseUpdateInput(candidate: Record<string, unknown>): UpdateConversationInput {
  const input: UpdateConversationInput = {};
  if (typeof candidate.type === "string") input.type = candidate.type;
  if (typeof candidate.title === "string") input.title = candidate.title.trim();
  if (typeof candidate.prompt === "string") input.prompt = candidate.prompt.trim();
  if (typeof candidate.status === "string") input.status = candidate.status;
  if (candidate.stage === null || typeof candidate.stage === "string")
    input.stage = candidate.stage;
  if (candidate.output === null || typeof candidate.output === "string")
    input.output = candidate.output;
  if (candidate.feedback === null || typeof candidate.feedback === "string")
    input.feedback = candidate.feedback;
  if (typeof candidate.pinned === "boolean") input.pinned = candidate.pinned;
  if (typeof candidate.unread === "boolean") input.unread = candidate.unread;
  return input;
}

export function registerConversationRoutes(router: Router, db: Database): void {
  router.post("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const type = typeof body.type === "string" ? body.type : undefined;
    const title =
      typeof body.title === "string" && body.title.trim() !== ""
        ? body.title.trim()
        : null;
    const prompt =
      typeof body.prompt === "string" && body.prompt.trim() !== ""
        ? body.prompt.trim()
        : null;

    // The brief text is required; title falls back to the prompt.
    if (!prompt) {
      sendJson(res, 400, { error: "prompt is required" });
      return;
    }

    // Enforce the monthly quota server-side (FE gating is UX only).
    const sub = await getActiveSubscription(db, auth.userId);
    const plan = sub?.planSlug ? PLANS[sub.planSlug as keyof typeof PLANS] : undefined;
    if (!plan) {
      sendJson(res, 403, { error: "active subscription required" });
      return;
    }
    if (plan.limit !== null) {
      const used = await getMonthlyUsage(db, auth.userId);
      if (used >= plan.limit) {
        sendJson(res, 403, { error: "monthly quota reached" });
        return;
      }
    }

    try {
      const conversation = await createConversation(db, auth.userId, {
        id: id || undefined,
        type: (type as ConversationType) ?? "general",
        title: title ?? prompt,
        prompt,
      });
      await incrementUsage(db, auth.userId);
      sendJson(res, 201, conversation);
    } catch (err) {
      sendCaughtError(res, err, "conversation creation");
    }
  });

  router.get("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, await listConversations(db, auth.userId));
  });

  router.get("/api/conversations/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    sendJson(res, 200, conversation);
  });

  router.put("/api/conversations/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const updated = await updateConversation(db, params.id!, parseUpdateInput(body));
    sendJson(res, 200, updated);
  });

  // Lightweight update — used for like/dislike feedback and quick toggles.
  router.patch("/api/conversations/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const updated = await updateConversation(db, params.id!, parseUpdateInput(body));
    sendJson(res, 200, updated);
  });

  router.delete("/api/conversations/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    await deleteConversation(db, params.id!);
    sendJson(res, 200, { deleted: true });
  });
}
