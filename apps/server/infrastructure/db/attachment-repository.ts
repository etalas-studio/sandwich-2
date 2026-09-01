import type { AttachmentRepository } from "../../application/ports/attachment-repository.js";
import type { Attachment, ExtractStatus } from "../../domain/attachments/index.js";
import type { Database } from "../../db/connection.js";
import {
  getAttachment,
  listAttachments,
  listAttachmentsByStatus,
  getPendingAttachmentIds,
  setExtractionStatus,
  resetStaleExtractions,
} from "../../db/repo/attachments.js";

// Legacy db layer uses `extractStatus: string`; domain narrows to ExtractStatus.
function toAttachment(a: {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractStatus: string;
  createdAt: Date;
  url: string;
}): Attachment {
  return { ...a, extractStatus: a.extractStatus as ExtractStatus };
}

export class DrizzleAttachmentRepository implements AttachmentRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Attachment | undefined> {
    const a = await getAttachment(this.db, id);
    return a ? toAttachment(a) : undefined;
  }

  async listByConversation(conversationId: string): Promise<Attachment[]> {
    const rows = await listAttachments(this.db, conversationId);
    return rows.map(toAttachment);
  }

  listByStatus(
    status: ExtractStatus,
  ): Promise<Pick<Attachment, "id" | "storageKey" | "filename" | "mimeType">[]> {
    return listAttachmentsByStatus(this.db, status);
  }

  getPendingIds(conversationId: string): Promise<string[]> {
    return getPendingAttachmentIds(this.db, conversationId);
  }

  async updateStatus(id: string, status: ExtractStatus, summary?: string): Promise<void> {
    await setExtractionStatus(this.db, id, status, summary);
  }

  resetStaleExtractions(): Promise<void> {
    return resetStaleExtractions(this.db);
  }
}
