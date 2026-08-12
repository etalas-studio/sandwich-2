import { eq, asc } from "drizzle-orm";
import { chatMessages } from "../schema.js";
import type { Database } from "../connection.js";

export interface ChatMessage {
  id: number;
  ticketId: string;
  role: string;
  content: string;
  stage: string | null;
  createdAt: string;
}

export async function addChatMessage(
  db: Database,
  input: { ticketId: string; role: string; content: string; stage?: string | null },
): Promise<ChatMessage> {
  const now = new Date().toISOString();
  await db.insert(chatMessages).values({
    ticketId: input.ticketId,
    role: input.role,
    content: input.content,
    stage: input.stage ?? null,
    createdAt: now,
  });
  const rows = await db.select().from(chatMessages)
    .where(eq(chatMessages.ticketId, input.ticketId))
    .orderBy(asc(chatMessages.createdAt));
  return rows[rows.length - 1]!;
}

export async function getChatMessages(db: Database, ticketId: string): Promise<ChatMessage[]> {
  return db.select().from(chatMessages)
    .where(eq(chatMessages.ticketId, ticketId))
    .orderBy(asc(chatMessages.createdAt));
}
