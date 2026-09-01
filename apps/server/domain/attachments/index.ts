// domain/attachments/index.ts
export type ExtractStatus = "pending" | "processing" | "done" | "failed";

export interface Attachment {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractStatus: ExtractStatus;
  createdAt: Date;
  url: string;
}
