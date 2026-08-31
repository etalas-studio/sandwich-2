// domain/conversations/index.ts
export type Role = "system" | "user" | "assistant";

export interface ConversationTurn {
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  prompt: string;
  pipelineStage: string;
  pendingType: string | null;
  feedback: string | null;
  pinned: boolean;
  unread: boolean;
  shareToken: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  documentId: string | null;
  createdAt: Date;
}
