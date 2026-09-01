import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { documents, projects } from "../db/schema.js";
import type { Database } from "../db/connection.js";

export type DocumentType = "prd" | "quotation" | "prototype" | "specs" | "mom";

/**
 * An index row pointing at a file in the project's git repo. Postgres stores no
 * content — `relativePath` + `lastCommitSha` locate it on disk and in history.
 * One row per (projectId, type).
 */
export interface Document {
  id: string;
  projectId: string;
  conversationId: string | null;
  type: string;
  title: string;
  relativePath: string;
  lastCommitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function normalise(row: typeof documents.$inferSelect): Document {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    type: row.type,
    title: row.title,
    relativePath: row.relativePath,
    lastCommitSha: row.lastCommitSha,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface UpsertDocumentInput {
  projectId: string;
  conversationId: string | null;
  type: DocumentType;
  title: string;
  relativePath: string;
  lastCommitSha?: string | null;
}

/**
 * Creates or updates the (projectId, type) document row after a generation run.
 * Regenerating a deliverable overwrites the same file on disk, so it also
 * overwrites the same row here — never a new one.
 */
export async function upsertDocument(
  db: Database,
  input: UpsertDocumentInput,
): Promise<Document> {
  const now = new Date();
  await db
    .insert(documents)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      conversationId: input.conversationId,
      type: input.type,
      title: input.title,
      relativePath: input.relativePath,
      lastCommitSha: input.lastCommitSha ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [documents.projectId, documents.type],
      set: {
        title: input.title,
        relativePath: input.relativePath,
        conversationId: input.conversationId,
        lastCommitSha: input.lastCommitSha ?? null,
        updatedAt: now,
      },
    });
  return (await findProjectDocument(db, input.projectId, input.type))!;
}

/** Record the latest commit that touched this document's file. */
export async function setDocumentCommit(
  db: Database,
  id: string,
  sha: string,
): Promise<void> {
  await db
    .update(documents)
    .set({ lastCommitSha: sha, updatedAt: new Date() })
    .where(eq(documents.id, id));
}

/** Unscoped by id — callers that already hold a scoped row use this to re-read. */
export async function getDocument(db: Database, id: string): Promise<Document | null> {
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0] ? normalise(rows[0]) : null;
}

/** By id, scoped to the owning user via project ownership. */
export async function getOwnedDocument(
  db: Database,
  userId: string,
  id: string,
): Promise<Document | null> {
  const rows = await db
    .select({ doc: documents })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .where(and(eq(documents.id, id), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ? normalise(rows[0].doc) : null;
}

export async function listDocumentsForUser(
  db: Database,
  userId: string,
): Promise<Document[]> {
  const rows = await db
    .select({ doc: documents })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(documents.updatedAt));
  return rows.map((r) => normalise(r.doc));
}

export async function listProjectDocuments(
  db: Database,
  projectId: string,
): Promise<Document[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.updatedAt));
  return rows.map(normalise);
}

/** The single row for a deliverable type in a project (upsert lookup). */
export async function findProjectDocument(
  db: Database,
  projectId: string,
  type: DocumentType,
): Promise<Document | null> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, type)))
    .limit(1);
  return rows[0] ? normalise(rows[0]) : null;
}

/** Documents last generated in a conversation ("generated in"). */
export async function listConversationDocuments(
  db: Database,
  conversationId: string,
): Promise<Document[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.conversationId, conversationId))
    .orderBy(desc(documents.updatedAt));
  return rows.map(normalise);
}

/** Title-scoped retrieval — the explicit "buka PRD X" lookup. */
export async function findDocumentByTitle(
  db: Database,
  userId: string,
  title: string,
): Promise<Document | null> {
  const rows = await db
    .select({ doc: documents })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .where(and(eq(projects.userId, userId), eq(documents.title, title)))
    .limit(1);
  return rows[0] ? normalise(rows[0].doc) : null;
}

export async function updateDocumentTitle(
  db: Database,
  id: string,
  title: string,
): Promise<void> {
  await db.update(documents).set({ title, updatedAt: new Date() }).where(eq(documents.id, id));
}

/** Detach documents from a conversation being deleted — the files survive. */
export async function clearConversationDocuments(
  db: Database,
  conversationId: string,
): Promise<void> {
  await db
    .update(documents)
    .set({ conversationId: null })
    .where(eq(documents.conversationId, conversationId));
}

/** Delete every document row for a set of projects (user deletion cascade). */
export async function deleteDocumentsForProjects(
  db: Database,
  projectIds: string[],
): Promise<void> {
  if (projectIds.length === 0) return;
  await db.delete(documents).where(inArray(documents.projectId, projectIds));
}
