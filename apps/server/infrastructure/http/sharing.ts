import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { getConversation, updateConversation } from "../../conversations/db.js";
import { getMessages } from "../../db/repo/chat-messages.js";
import { listAttachments } from "../../db/repo/attachments.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { conversations as conversationsTable } from "../../db/schema.js";

export function registerShareRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.post("/api/conversations/:id/share", async (req, res) => {
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

    const shareToken =
      conversation.shareToken ?? randomBytes(24).toString("base64url");
    await updateConversation(db, req.params.id!, {
      shareToken,
      sharedAt: new Date(),
    });

    res.status(200).json({ shareToken, url: `/share/${shareToken}` });
  });

  router.post("/api/conversations/:id/unshare", async (req, res) => {
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
    await updateConversation(db, req.params.id!, { shareToken: null, sharedAt: null });
    res.status(200).json({ ok: true });
  });

  router.get("/api/share/:token", async (req, res) => {
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.shareToken, req.params.token!));
    const conversation = rows[0];
    if (!conversation) {
      res.status(404).json({ error: "share link not found" });
      return;
    }
    const messages = await getMessages(db, conversation.id);
    const attachments = await listAttachments(db, conversation.id);
    res.status(200).json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        prompt: conversation.prompt,
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
