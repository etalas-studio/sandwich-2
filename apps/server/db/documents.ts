import { and, desc, eq, inArray, max } from "drizzle-orm";
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

export async function getConversationIdForDocument(db: Database, documentId: string): Promise<string | null> {
  const rows = await db
    .select({ conversationId: conversationDocuments.conversationId })
    .from(conversationDocuments)
    .where(eq(conversationDocuments.documentId, documentId))
    .orderBy(desc(conversationDocuments.createdAt))
    .limit(1);
  return rows[0]?.conversationId ?? null;
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

/** Single query: versionNo for a set of version IDs. */
export async function getVersionNosByIds(
  db: Database,
  versionIds: string[],
): Promise<Map<string, number>> {
  if (versionIds.length === 0) return new Map();
  const rows = await db
    .select({ id: documentVersions.id, versionNo: documentVersions.versionNo })
    .from(documentVersions)
    .where(inArray(documentVersions.id, versionIds));
  return new Map(rows.map((r) => [r.id, r.versionNo]));
}

/** Single query: latest versionNo per document for a set of document IDs. */
export async function getLatestVersionNosForDocuments(
  db: Database,
  documentIds: string[],
): Promise<Map<string, number>> {
  if (documentIds.length === 0) return new Map();
  const rows = await db
    .select({ documentId: documentVersions.documentId, maxNo: max(documentVersions.versionNo) })
    .from(documentVersions)
    .where(inArray(documentVersions.documentId, documentIds))
    .groupBy(documentVersions.documentId);
  return new Map(rows.map((r) => [r.documentId, r.maxNo ?? 0]));
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

export async function setDocumentCurrentVersion(
  db: Database,
  documentId: string,
  versionId: string,
): Promise<void> {
  await db.update(documents)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

/** Move the active version pointer (rollback). Does not delete history. */
export async function rollbackDocument(
  db: Database,
  documentId: string,
  intent: "previous" | "latest",
): Promise<DocumentVersion | null> {
  const versions = await listVersions(db, documentId); // descending version_no
  if (versions.length === 0) return null;
  const doc = await getDocument(db, documentId);
  const current = doc?.currentVersionId
    ? versions.find((v) => v.id === doc.currentVersionId) ?? versions[0]!
    : versions[0]!;

  let target: DocumentVersion | null = null;
  if (intent === "latest") {
    target = versions[0]!;
  } else {
    const targetNo = current.versionNo - 1;
    target = versions.find((v) => v.versionNo === targetNo) ?? null;
  }

  if (target && target.id !== current.id) {
    await setDocumentCurrentVersion(db, documentId, target.id);
    return target;
  }
  return null;
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
