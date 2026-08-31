// domain/documents/index.ts
export type DocumentType = "prd" | "quotation" | "prototype" | "specs" | "mom";

export interface Document {
  id: string;
  userId: string;
  projectId: string;
  conversationId: string;
  title: string;
  type: DocumentType;
  relativePath: string;
  createdAt: Date;
  updatedAt: Date;
}
