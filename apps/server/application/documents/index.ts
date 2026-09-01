import type { DocumentRepository } from "../ports/document-repository.js";
import type { Document } from "../../domain/documents/index.js";

export class DocumentNotFoundError extends Error {
  constructor() {
    super("document not found");
    this.name = "DocumentNotFoundError";
  }
}

export async function listDocuments(
  repo: DocumentRepository,
  userId: string,
): Promise<Document[]> {
  return repo.listForUser(userId);
}

export async function getDocument(
  repo: DocumentRepository,
  userId: string,
  id: string,
): Promise<Document> {
  const doc = await repo.findOwnedById(userId, id);
  if (!doc) throw new DocumentNotFoundError();
  return doc;
}

export async function findDocumentByTitle(
  repo: DocumentRepository,
  userId: string,
  title: string,
): Promise<Document | undefined> {
  return repo.findByTitle(userId, title);
}

export async function updateDocumentTitle(
  repo: DocumentRepository,
  userId: string,
  id: string,
  title: string,
): Promise<void> {
  const doc = await repo.findOwnedById(userId, id);
  if (!doc) throw new DocumentNotFoundError();
  await repo.updateTitle(id, title);
}
