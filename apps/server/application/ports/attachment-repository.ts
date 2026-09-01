import type { Attachment, ExtractStatus } from "../../domain/attachments/index.js";

export interface AttachmentRepository {
  findById(id: string): Promise<Attachment | undefined>;
  listByConversation(conversationId: string): Promise<Attachment[]>;
  listByStatus(status: ExtractStatus): Promise<Pick<Attachment, "id" | "storageKey" | "filename" | "mimeType">[]>;
  getPendingIds(conversationId: string): Promise<string[]>;
  updateStatus(id: string, status: ExtractStatus, summary?: string): Promise<void>;
  resetStaleExtractions(): Promise<void>;
}
