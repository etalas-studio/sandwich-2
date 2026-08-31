import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
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
import { sendJson, sendCaughtError, readJsonBody } from "../../http-utils.js";
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
    const rawPendingType = typeof body.pendingType === "string" ? body.pendingType : undefined;
    const pendingType =
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
      sendJson(res, 400, { error: "prompt is required" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    if (!sub) {
      sendJson(res, 403, { error: "active subscription required" });
      return;
    }

    try {
      const conversation = await createConversation(db, auth.userId, {
        id: id || undefined,
        title: title ?? prompt,
        prompt,
        pendingType,
        projectId,
      });
      sendJson(res, 201, conversation);
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        sendJson(res, 404, { error: "project not found" });
        return;
      }
      sendCaughtError(res, err, "conversation creation");
    }
  });

  router.get("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.searchParams.get("groupBy") === "project") {
      sendJson(res, 200, await listProjectsWithConversations(db, auth.userId));
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
    closeInFlight(params.id!);
    await deleteConversation(db, params.id!);
    deleteConversationSession(params.id!);
    res.writeHead(204).end();
  });
}
