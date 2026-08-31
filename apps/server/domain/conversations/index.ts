// domain/conversations/index.ts
export type Role = "system" | "user" | "assistant";

export interface ConversationTurn {
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  stage: string;
  pendingType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: Date;
}
