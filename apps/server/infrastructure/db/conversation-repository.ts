import type { ConversationRepository } from "../../application/ports/conversation-repository.js";
import type { Conversation, ChatMessage, ConversationTurn } from "../../domain/conversations/index.js";
import type { Database } from "../../db/connection.js";
import {
  getConversation,
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
} from "../../conversations/db.js";
import type { DocumentType } from "../../documents/db.js";
import {
  getMessagesForPrompt,
  addChatMessage,
  getMessage,
  getMessages,
} from "../../db/repo/chat-messages.js";

function toDomainMessage(m: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  documentId: string | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role as ChatMessage["role"],
    content: m.content,
    documentId: m.documentId,
    createdAt: m.createdAt,
  };
}

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Conversation | undefined> {
    return (await getConversation(this.db, id)) ?? undefined;
  }

  listForUser(userId: string): Promise<Conversation[]> {
    return listConversations(this.db, userId);
  }

  create(input: {
    userId: string;
    projectId: string | null;
    title: string;
    prompt?: string;
    pendingType?: string | null;
  }): Promise<Conversation> {
    return createConversation(this.db, input.userId, {
      title: input.title,
      prompt: input.prompt ?? "",
      pendingType: (input.pendingType ?? undefined) as DocumentType | undefined,
      projectId: input.projectId ?? undefined,
    });
  }

  async updateStage(id: string, stage: string, pendingType: string | null): Promise<void> {
    await updateConversation(this.db, id, { pipelineStage: stage, pendingType });
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await updateConversation(this.db, id, { title });
  }

  async delete(id: string): Promise<void> {
    await deleteConversation(this.db, id);
  }

  async getMessagesForPrompt(conversationId: string): Promise<ConversationTurn[]> {
    const msgs = await getMessagesForPrompt(this.db, conversationId);
    return msgs.map((m) => ({ role: m.role as ConversationTurn["role"], content: m.content }));
  }

  async addMessage(conversationId: string, role: string, content: string): Promise<ChatMessage> {
    const id = await addChatMessage(this.db, { conversationId, role, content });
    const msg = await getMessage(this.db, id);
    return toDomainMessage(msg!);
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const msgs = await getMessages(this.db, conversationId);
    return msgs.map(toDomainMessage);
  }
}
