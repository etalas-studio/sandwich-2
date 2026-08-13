import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Router } from "../router.js";
import { getConversation, updateConversation } from "../db/conversations.js";
import { getMessages } from "../db/repo/chat-messages.js";
import { listAttachments } from "../db/repo/attachments.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson } from "../http-utils.js";
import { conversations as conversationsTable } from "../db/schema.js";
import type { Database } from "../db/connection.js";

export function registerShareRoutes(router: Router, db: Database): void {
  router.post("/api/conversations/:id/share", async (req, res, params) => {
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

    const shareToken =
      conversation.shareToken ?? randomBytes(24).toString("base64url");
    await updateConversation(db, params.id!, {
      shareToken,
      sharedAt: new Date(),
    });

    sendJson(res, 200, { shareToken, url: `/share/${shareToken}` });
  });

  router.post("/api/conversations/:id/unshare", async (req, res, params) => {
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

    await updateConversation(db, params.id!, {
      shareToken: null,
      sharedAt: null,
    });
    sendJson(res, 200, { unshared: true });
  });

  // Public, read-only share view — no auth required.
  router.get("/api/share/:token", async (_req, res, params) => {
    const token = params.token!;
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.shareToken, token))
      .limit(1);
    if (rows.length === 0) {
      sendJson(res, 404, { error: "share link not found" });
      return;
    }
    const conversation = rows[0]!;
    const messages = await getMessages(db, conversation.id);
    const attachments = await listAttachments(db, conversation.id);

    sendJson(res, 200, {
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: conversation.title,
        prompt: conversation.prompt,
        output: conversation.output,
        createdAt: conversation.createdAt,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      attachments,
    });
  });
}
