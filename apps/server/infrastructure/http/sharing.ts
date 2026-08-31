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

    await db
      .update(conversationsTable)
      .set({ shareToken: null, sharedAt: null })
      .where(eq(conversationsTable.id, req.params.id!));

    res.status(200).json({ ok: true });
  });

  router.get("/api/share/:token", async (req, res) => {
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.shareToken, req.params.token!))
      .limit(1);

    if (!conversation) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const messages = await getMessages(db, conversation.id);
    const attachments = await listAttachments(db, conversation.id);

    res.status(200).json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        sharedAt: conversation.sharedAt,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      attachments,
    });
  });
}
