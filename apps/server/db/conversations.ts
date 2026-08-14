import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { conversations, chatMessages, attachments } from "./schema.js";
import type { Database } from "./connection.js";

export type ConversationType =
  | "prd"
  | "mom"
  | "quotation"
  | "specs"
  | "prototype"
  | "workflow"
  | "general";

export type ConversationStatus = "backlog" | "in_progress" | "done";

export interface Conversation {
  id: string;
  userId: string;
  type: string;
  title: string;
  prompt: string;
  status: string;
  stage: string | null;
  output: string | null;
  pipelineStage: string;
  pendingType: string | null;
  feedback: string | null;
  pinned: boolean;
  unread: boolean;
  shareToken: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  id?: string;
  type?: ConversationType;
  title: string;
  prompt: string;
}

export interface UpdateConversationInput {
  type?: string | null;
  title?: string;
  prompt?: string;
  status?: string;
  stage?: string | null;
  output?: string | null;
  pipelineStage?: string;
  pendingType?: string | null;
  feedback?: string | null;
  pinned?: boolean;
  unread?: boolean;
  shareToken?: string | null;
  sharedAt?: Date | null;
}

function normaliseConversation(
  row: typeof conversations.$inferSelect,
): Conversation {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    prompt: row.prompt,
    status: row.status,
    stage: row.stage,
    output: row.output,
    pipelineStage: row.pipelineStage,
    pendingType: row.pendingType,
    feedback: row.feedback,
    pinned: row.pinned,
    unread: row.unread,
    shareToken: row.shareToken,
    sharedAt: row.sharedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createConversation(
  db: Database,
  userId: string,
  input: CreateConversationInput,
): Promise<Conversation> {
  const id = input.id?.trim() || `c-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  await db.insert(conversations).values({
    id,
    userId,
    type: input.type ?? "general",
    title: input.title,
    prompt: input.prompt,
    status: "backlog",
    createdAt: now,
    updatedAt: now,
  });
  return (await getConversation(db, id))!;
}

export async function listConversations(
  db: Database,
  userId: string,
): Promise<Conversation[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt));
  return rows.map(normaliseConversation);
}

export async function getConversation(
  db: Database,
  id: string,
): Promise<Conversation | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  return normaliseConversation(rows[0]!);
}

export async function updateConversation(
  db: Database,
  id: string,
  input: UpdateConversationInput,
): Promise<Conversation | null> {
  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (existing.length === 0) return null;

  const now = new Date();
  const sets: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) sets.type = input.type;
  if (input.title !== undefined) sets.title = input.title;
  if (input.prompt !== undefined) sets.prompt = input.prompt;
  if (input.status !== undefined) sets.status = input.status;
  if (input.stage !== undefined) sets.stage = input.stage;
  if (input.output !== undefined) sets.output = input.output;
  if (input.pipelineStage !== undefined) sets.pipelineStage = input.pipelineStage;
  if (input.pendingType !== undefined) sets.pendingType = input.pendingType;
  if (input.feedback !== undefined) sets.feedback = input.feedback;
  if (input.pinned !== undefined) sets.pinned = input.pinned;
  if (input.unread !== undefined) sets.unread = input.unread;
  if (input.shareToken !== undefined) sets.shareToken = input.shareToken;
  if (input.sharedAt !== undefined) sets.sharedAt = input.sharedAt;

  await db.update(conversations).set(sets).where(eq(conversations.id, id));
  return getConversation(db, id);
}

/**
 * Deletes a conversation and its dependents (attachments first, then
 * messages, then the conversation) inside a single transaction. FK
 * constraints use ON DELETE NO ACTION, so ordering matters.
 */
export async function deleteConversation(
  db: Database,
  id: string,
): Promise<boolean> {
  const existing = await getConversation(db, id);
  if (!existing) return false;

  await db.transaction(async (tx) => {
    await tx.delete(attachments).where(eq(attachments.conversationId, id));
    await tx.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await tx.delete(conversations).where(eq(conversations.id, id));
  });
  return true;
}
