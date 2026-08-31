import type { Conversation, ChatMessage, ConversationTurn } from "../../domain/conversations/index.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | undefined>;
  listForUser(userId: string): Promise<Conversation[]>;
  create(input: { userId: string; projectId: string; title: string }): Promise<Conversation>;
  updateStage(id: string, stage: PipelineStage, pendingType: DocumentType | null): Promise<void>;
  updateTitle(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
  getMessagesForPrompt(conversationId: string): Promise<ConversationTurn[]>;
  addMessage(conversationId: string, role: string, content: string): Promise<ChatMessage>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
}
