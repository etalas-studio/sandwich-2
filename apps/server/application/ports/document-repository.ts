import type { Document, DocumentType } from "../../domain/documents/index.js";

export interface DocumentRepository {
  findById(id: string): Promise<Document | undefined>;
  findOwnedById(userId: string, id: string): Promise<Document | undefined>;
  findByTitle(userId: string, title: string): Promise<Document | undefined>;
  listForUser(userId: string): Promise<Document[]>;
  upsert(input: {
    userId: string;
    projectId: string;
    conversationId: string;
    title: string;
    type: DocumentType;
    relativePath: string;
  }): Promise<Document>;
  updateTitle(id: string, title: string): Promise<void>;
}
