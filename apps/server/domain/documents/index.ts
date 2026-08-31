// domain/documents/index.ts
export type DocumentType = "prd" | "quotation" | "prototype" | "specs" | "mom";

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
