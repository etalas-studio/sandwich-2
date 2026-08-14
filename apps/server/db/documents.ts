import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  conversationDocuments,
  documentFiles,
  documents,
  documentVersions,
} from "./schema.js";
import type { Database } from "./connection.js";

export type DocumentType = "prd" | "quotation" | "prototype" | "specs";

export interface Document {
  id: string;
  userId: string;
  type: string;
  title: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  content: string;
  promptUsed: string | null;
  createdAt: Date;
}

export interface DocumentFile {
  id: number;
  documentId: string;
  versionNo: number;
  path: string;
  content: string;
  createdAt: Date;
}

export async function createDocument(
  db: Database,
  input: { userId: string; type: DocumentType; title: string },
): Promise<Document> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(documents).values({
    id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    createdAt: now,
    updatedAt: now,
  });
  return (await getDocument(db, id))!;
}

export async function getDocument(db: Database, id: string): Promise<Document | null> {
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listDocuments(db: Database, userId: string): Promise<Document[]> {
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.updatedAt));
}

/** Title-scoped retrieval — the explicit "buka PRD X" lookup. */
export async function findDocumentByTitle(
  db: Database,
  userId: string,
  title: string,
): Promise<Document | null> {
  const rows = await db.select().from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.title, title)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateDocumentTitle(db: Database, id: string, title: string): Promise<void> {
  await db.update(documents).set({ title, updatedAt: new Date() }).where(eq(documents.id, id));
}

export async function createDocumentVersion(
  db: Database,
  input: { documentId: string; versionNo: number; content: string; promptUsed?: string },
): Promise<DocumentVersion> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(documentVersions).values({
    id,
    documentId: input.documentId,
    versionNo: input.versionNo,
    content: input.content,
    promptUsed: input.promptUsed ?? null,
    createdAt: now,
  });
  await db.update(documents)
    .set({ currentVersionId: id, updatedAt: now })
    .where(eq(documents.id, input.documentId));
  return (await getVersion(db, id))!;
}

export async function getVersion(db: Database, id: string): Promise<DocumentVersion | null> {
  const rows = await db.select().from(documentVersions).where(eq(documentVersions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestVersion(db: Database, documentId: string): Promise<DocumentVersion | null> {
  const rows = await db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1);
  return rows[0] ?? null;
}

export async function listVersions(db: Database, documentId: string): Promise<DocumentVersion[]> {
  return db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNo));
}

export async function getNextVersionNo(db: Database, documentId: string): Promise<number> {
  const latest = await getLatestVersion(db, documentId);
  return (latest?.versionNo ?? 0) + 1;
}

// ── conversation ↔ document link ──────────────────────────────────────────────

export async function linkConversationDocument(
  db: Database,
  conversationId: string,
  documentId: string,
): Promise<void> {
  await db.insert(conversationDocuments).values({
    conversationId,
    documentId,
    createdAt: new Date(),
  }).onConflictDoNothing({
    target: [conversationDocuments.conversationId, conversationDocuments.documentId],
  });
}

export async function listConversationDocuments(db: Database, conversationId: string): Promise<Document[]> {
  const rows = await db.select({ doc: documents })
    .from(conversationDocuments)
    .innerJoin(documents, eq(conversationDocuments.documentId, documents.id))
    .where(eq(conversationDocuments.conversationId, conversationId));
  return rows.map((r) => r.doc);
}

// ── multi-file documents (prototype) ─────────────────────────────────────────

export async function saveDocumentFile(
  db: Database,
  documentId: string,
  versionNo: number,
  path: string,
  content: string,
): Promise<void> {
  await db.insert(documentFiles).values({ documentId, versionNo, path, content, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [documentFiles.documentId, documentFiles.versionNo, documentFiles.path],
      set: { content, createdAt: new Date() },
    });
}

export async function getDocumentFiles(
  db: Database,
  documentId: string,
  versionNo: number,
): Promise<DocumentFile[]> {
  return db.select().from(documentFiles)
    .where(and(eq(documentFiles.documentId, documentId), eq(documentFiles.versionNo, versionNo)));
}

export async function getDocumentFile(
  db: Database,
  documentId: string,
  versionNo: number,
  path: string,
): Promise<DocumentFile | null> {
  const rows = await db.select().from(documentFiles)
    .where(and(
      eq(documentFiles.documentId, documentId),
      eq(documentFiles.versionNo, versionNo),
      eq(documentFiles.path, path),
    ))
    .limit(1);
  return rows[0] ?? null;
}
