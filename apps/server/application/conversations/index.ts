import type { ConversationRepository } from "../ports/conversation-repository.js";
import type { ProjectRepository } from "../ports/project-repository.js";
import type { Conversation, ChatMessage } from "../../domain/conversations/index.js";

export class ConversationNotFoundError extends Error {
  constructor() {
    super("conversation not found");
    this.name = "ConversationNotFoundError";
  }
}

export async function listConversations(
  repo: ConversationRepository,
  userId: string,
): Promise<Conversation[]> {
  return repo.listForUser(userId);
}

export async function getConversation(
  repo: ConversationRepository,
  userId: string,
  id: string,
): Promise<Conversation> {
  const conversation = await repo.findById(id);
  if (!conversation || conversation.userId !== userId) {
    throw new ConversationNotFoundError();
  }
  return conversation;
}

export async function createConversation(
  repos: { conversations: ConversationRepository; projects: ProjectRepository },
  userId: string,
  input: { projectId?: string; title: string },
): Promise<Conversation> {
  // If a projectId is given, verify ownership before creating.
  if (input.projectId) {
    const project = await repos.projects.findOwnedById(userId, input.projectId);
    if (!project) {
      throw new Error("project not found");
    }
  }
  return repos.conversations.create({
    userId,
    projectId: input.projectId ?? "",
    title: input.title,
  });
}

export async function deleteConversation(
  repo: ConversationRepository,
  userId: string,
  id: string,
): Promise<void> {
  const conversation = await repo.findById(id);
  if (!conversation || conversation.userId !== userId) {
    throw new ConversationNotFoundError();
  }
  await repo.delete(id);
}

export async function listConversationMessages(
  repo: ConversationRepository,
  conversationId: string,
): Promise<ChatMessage[]> {
  return repo.listMessages(conversationId);
}
