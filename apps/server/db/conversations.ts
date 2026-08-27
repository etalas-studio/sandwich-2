import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  conversations,
  chatMessages,
  attachments,
  conversationDocuments,
} from "./schema.js";
import type { Database } from "./connection.js";
import type { DocumentType } from "./documents.js";
import {
  createProject,
  getProject,
  deriveProjectTitle,
  ProjectNotFoundError,
} from "./projects.js";

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
  projectId: string | null;
  title: string;
  prompt: string;
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
  title: string;
  prompt: string;
  // Pre-selected deliverable (dropdown). Skips the "which deliverable?"
  // prompt; the next generate run asks clarifying questions for this type.
  pendingType?: DocumentType;
  // Existing project to attach to. Absent → a fresh project is created and
  // attached (title seeded from this conversation's title/prompt).
  projectId?: string;
}

export interface UpdateConversationInput {
  title?: string;
  prompt?: string;
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
    projectId: row.projectId,
    title: row.title,
    prompt: row.prompt,
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
  const id = input.id?.trim() || randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    const txDb = tx as unknown as Database;

    // Resolve the owning project. An explicit projectId must belong to this
    // user — otherwise the conversation (and, later, an agent with cwd set to
    // the project dir) would attach to someone else's workspace.
    let projectId: string;
    if (input.projectId) {
      const owned = await getProject(txDb, userId, input.projectId);
      if (!owned) throw new ProjectNotFoundError();
      projectId = owned.id;
    } else {
      const project = await createProject(txDb, userId, {
        title: deriveProjectTitle(input.title, input.prompt),
      });
      projectId = project.id;
    }

    await tx.insert(conversations).values({
      id,
      userId,
      projectId,
      title: input.title,
      prompt: input.prompt,
      pipelineStage: input.pendingType ? "choosing_deliverable" : "intake",
      pendingType: input.pendingType ?? null,
      createdAt: now,
      updatedAt: now,
    });
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

  if (input.title !== undefined) sets.title = input.title;
  if (input.prompt !== undefined) sets.prompt = input.prompt;
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
 * Deletes a conversation and its dependents (conversation_documents links,
 * attachments, then messages, then the conversation) inside a single
 * transaction. FK constraints use ON DELETE NO ACTION, so ordering matters.
 *
 * The owning project is left intact — deleting a conversation never deletes
 * its project or the project's other conversations.
 */
export async function deleteConversation(
  db: Database,
  id: string,
): Promise<boolean> {
  const existing = await getConversation(db, id);
  if (!existing) return false;

  await db.transaction(async (tx) => {
    await tx
      .delete(conversationDocuments)
      .where(eq(conversationDocuments.conversationId, id));
    await tx.delete(attachments).where(eq(attachments.conversationId, id));
    await tx.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await tx.delete(conversations).where(eq(conversations.id, id));
  });
  return true;
}
