import { and, eq, asc, inArray } from "drizzle-orm";
import { chatMessages, attachments } from "../schema.js";
import type { Database } from "../connection.js";
import { getAttachmentUrl } from "../../storage/r2.js";

export interface MessageAttachment {
  id: string;
  conversationId: string | null;
  messageId: number | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface ChatMessage {
  id: number;
  conversationId: string;
  role: string;
  content: string;
  documentId: string | null;
  createdAt: Date;
  attachments: MessageAttachment[];
}

async function toAttachment(
  row: typeof attachments.$inferSelect,
): Promise<MessageAttachment> {
  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: await getAttachmentUrl(row.storageKey),
  };
}

/** Simple insert — used for assistant replies (no attachments). */
export async function addChatMessage(
  db: Database,
  input: {
    conversationId: string;
    role: string;
    content: string;
    documentId?: string | null;
  },
): Promise<number> {
  const now = new Date();
  const [row] = await db
    .insert(chatMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      documentId: input.documentId ?? null,
      createdAt: now,
    })
    .returning({ id: chatMessages.id });
  return row!.id;
}

/** Creates a user message and links the given attachments to it. */
export async function createMessage(
  db: Database,
  input: {
    conversationId: string;
    userId: string;
    content: string;
    attachmentIds?: string[];
  },
): Promise<ChatMessage> {
  const id = await addChatMessage(db, {
    conversationId: input.conversationId,
    role: "user",
    content: input.content,
  });

  const ids = (input.attachmentIds ?? []).filter(Boolean);
  if (ids.length > 0) {
    await db
      .update(attachments)
      .set({ conversationId: input.conversationId, messageId: id })
      .where(
        and(inArray(attachments.id, ids), eq(attachments.userId, input.userId)),
      );
  }

  return (await getMessage(db, id))!;
}

export async function getMessage(
  db: Database,
  id: number,
): Promise<ChatMessage | null> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0]!;
  const atts = await db
    .select()
    .from(attachments)
    .where(eq(attachments.messageId, id));
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    documentId: row.documentId,
    createdAt: row.createdAt,
    attachments: await Promise.all(atts.map(toAttachment)),
  };
}

export async function getMessages(
  db: Database,
  conversationId: string,
): Promise<ChatMessage[]> {
  const msgs = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));

  const atts = await db
    .select()
    .from(attachments)
    .where(eq(attachments.conversationId, conversationId));

  const byMessage = new Map<number, MessageAttachment[]>();
  for (const a of atts) {
    if (a.messageId == null) continue;
    const item = await toAttachment(a);
    const list = byMessage.get(a.messageId) ?? [];
    list.push(item);
    byMessage.set(a.messageId, list);
  }

  return msgs.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    documentId: m.documentId,
    createdAt: m.createdAt,
    attachments: byMessage.get(m.id) ?? [],
  }));
}

/** Lightweight role/content history for the AI engine (no attachment signing). */
export async function getMessageHistory(
  db: Database,
  conversationId: string,
): Promise<{ id: number; role: string; content: string }[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.map((m) => ({ id: m.id, role: m.role, content: m.content }));
}

/** Message history with attachment extraction metadata (no URL signing). */
export async function getMessagesForPrompt(
  db: Database,
  conversationId: string,
): Promise<
  {
    id: number;
    role: string;
    content: string;
    attachments: {
      filename: string;
      mimeType: string;
      extractedText: string | null;
      extractStatus: string;
    }[];
  }[]
> {
  const msgs = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));

  const atts = await db
    .select()
    .from(attachments)
    .where(eq(attachments.conversationId, conversationId));

  const byMessage = new Map<number, typeof atts>();
  for (const a of atts) {
    if (a.messageId == null) continue;
    const list = byMessage.get(a.messageId) ?? [];
    list.push(a);
    byMessage.set(a.messageId, list);
  }

  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    attachments: (byMessage.get(m.id) ?? []).map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      extractedText: a.extractedText,
      extractStatus: a.extractStatus,
    })),
  }));
}

export async function updateMessageContent(db: Database, id: number, content: string): Promise<void> {
  await db.update(chatMessages).set({ content }).where(eq(chatMessages.id, id));
}

export async function deleteMessage(db: Database, id: number): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.id, id));
}
