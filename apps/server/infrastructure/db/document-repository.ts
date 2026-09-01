import type { DocumentRepository } from "../../application/ports/document-repository.js";
import type { Document, DocumentType } from "../../domain/documents/index.js";
import type { Database } from "../../db/connection.js";
import {
  getDocument,
  getOwnedDocument,
  findDocumentByTitle,
  listDocumentsForUser,
  upsertDocument,
  updateDocumentTitle,
} from "../../documents/db.js";

// The legacy db layer uses `type: string`; domain narrows to DocumentType.
function toDoc(d: {
  id: string;
  projectId: string;
  conversationId: string | null;
  type: string;
  title: string;
  relativePath: string;
  lastCommitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Document {
  return { ...d, type: d.type as DocumentType };
}

export class DrizzleDocumentRepository implements DocumentRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Document | undefined> {
    const d = await getDocument(this.db, id);
    return d ? toDoc(d) : undefined;
  }

  async findOwnedById(userId: string, id: string): Promise<Document | undefined> {
    const d = await getOwnedDocument(this.db, userId, id);
    return d ? toDoc(d) : undefined;
  }

  async findByTitle(userId: string, title: string): Promise<Document | undefined> {
    const d = await findDocumentByTitle(this.db, userId, title);
    return d ? toDoc(d) : undefined;
  }

  async listForUser(userId: string): Promise<Document[]> {
    const rows = await listDocumentsForUser(this.db, userId);
    return rows.map(toDoc);
  }

  async upsert(input: {
    userId: string;
    projectId: string;
    conversationId: string;
    title: string;
    type: DocumentType;
    relativePath: string;
  }): Promise<Document> {
    const d = await upsertDocument(this.db, {
      projectId: input.projectId,
      conversationId: input.conversationId,
      type: input.type,
      title: input.title,
      relativePath: input.relativePath,
    });
    return toDoc(d);
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await updateDocumentTitle(this.db, id, title);
  }
}
