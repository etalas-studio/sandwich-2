import { and, eq, asc, inArray } from "drizzle-orm";
import { attachments } from "../schema.js";
import type { Database } from "../connection.js";
import { getAttachmentUrl } from "../../storage/r2.js";

export type ExtractStatus = "pending" | "processing" | "done" | "failed";

export interface Attachment {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: number | null;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractStatus: string;
  createdAt: Date;
  url: string;
}

export interface CreateAttachmentInput {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId?: number | null;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

function normaliseAttachment(
  row: typeof attachments.$inferSelect,
): Attachment {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    storageKey: row.storageKey,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    extractedText: row.extractedText,
    extractStatus: row.extractStatus,
    createdAt: row.createdAt,
    url: "", // filled in by the caller after signing
  };
}

export async function createAttachment(
  db: Database,
  input: CreateAttachmentInput,
): Promise<Attachment> {
  const now = new Date();
  await db.insert(attachments).values({
    id: input.id,
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId ?? null,
    storageKey: input.storageKey,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    createdAt: now,
  });
  const row = await getAttachmentRow(db, input.id);
  const attachment = normaliseAttachment(row!);
  attachment.url = await getAttachmentUrl(attachment.storageKey);
  return attachment;
}

async function getAttachmentRow(
  db: Database,
  id: string,
): Promise<typeof attachments.$inferSelect | null> {
  const rows = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAttachment(
  db: Database,
  id: string,
): Promise<Attachment | null> {
  const row = await getAttachmentRow(db, id);
  if (!row) return null;
  const attachment = normaliseAttachment(row);
  attachment.url = await getAttachmentUrl(attachment.storageKey);
  return attachment;
}

export async function listAttachments(
  db: Database,
  conversationId: string,
): Promise<Attachment[]> {
  const rows = await db
    .select()
    .from(attachments)
    .where(eq(attachments.conversationId, conversationId))
    .orderBy(asc(attachments.createdAt));
  const result: Attachment[] = [];
  for (const row of rows) {
    const attachment = normaliseAttachment(row);
    attachment.url = await getAttachmentUrl(attachment.storageKey);
    result.push(attachment);
  }
  return result;
}

export async function setExtractionStatus(
  db: Database,
  id: string,
  status: ExtractStatus,
  extractedText?: string,
): Promise<void> {
  await db
    .update(attachments)
    .set({
      extractStatus: status,
      ...(extractedText !== undefined ? { extractedText } : {}),
    })
    .where(eq(attachments.id, id));
}

export async function getPendingAttachmentIds(
  db: Database,
  conversationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(
      and(
        eq(attachments.conversationId, conversationId),
        inArray(attachments.extractStatus, ["pending", "processing"]),
      ),
    );
  return rows.map((r) => r.id);
}

/** Recovers rows stuck in `processing` after a server restart. */
export async function resetStaleExtractions(db: Database): Promise<void> {
  await db
    .update(attachments)
    .set({ extractStatus: "pending" })
    .where(eq(attachments.extractStatus, "processing"));
}

export async function listAttachmentsByStatus(
  db: Database,
  status: ExtractStatus,
): Promise<
  { id: string; storageKey: string; filename: string; mimeType: string }[]
> {
  return db
    .select({
      id: attachments.id,
      storageKey: attachments.storageKey,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
    })
    .from(attachments)
    .where(eq(attachments.extractStatus, status));
}
