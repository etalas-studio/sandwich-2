import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  users, sessions, projects, conversations, chatMessages, attachments,
  payments, subscriptions, usage, userPreferences, documents,
  passwordResetTokens, emailVerificationTokens,
} from "./schema.js";
import type { Database } from "./connection.js";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  role: string;
  createdAt: Date;
}

export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
}

export async function createUser(db: Database, input: NewUser): Promise<User> {
  const id = randomUUID();
  const createdAt = new Date();
  await db.insert(users).values({
    id,
    username: input.username,
    email: input.email,
    passwordHash: input.passwordHash,
    createdAt,
  });
  return (await getUserById(db, id))!;
}

export async function getUserById(db: Database, id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (rows.length === 0) return null;
  return mapUser(rows[0]!);
}

export async function getUserByUsername(db: Database, username: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows.length === 0) return null;
  return mapUser(rows[0]!);
}

export async function getUserByEmail(db: Database, email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) return null;
  return mapUser(rows[0]!);
}

export async function updatePassword(db: Database, userId: string, newPasswordHash: string): Promise<void> {
  const result = await db.update(users)
    .set({ passwordHash: newPasswordHash })
    .where(eq(users.id, userId));
  if (result.rowCount === 0) throw new Error("user not found");
}

export async function markEmailVerified(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
}

export async function deleteUser(db: Database, userId: string): Promise<void> {
  const { inArray } = await import("drizzle-orm");

  const userConvIds = (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.userId, userId))).map(r => r.id);
  const userProjectIds = (await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId))).map(r => r.id);

  // Best-effort: remove each conversation's on-disk Pi session store. The
  // project directories themselves are M5-03's job.
  const { deleteConversationSession } = await import("../projects/sessions.js");
  for (const id of userConvIds) deleteConversationSession(id);

  // chat_messages FK both conversations and documents — clear them first so the
  // document rows below (and conversations later) can go.
  if (userConvIds.length > 0) {
    await db.delete(chatMessages).where(inArray(chatMessages.conversationId, userConvIds));
  }
  // documents FK projects and conversations — must precede both.
  if (userProjectIds.length > 0) {
    await db.delete(documents).where(inArray(documents.projectId, userProjectIds));
  }

  // tables directly referencing users
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
  await db.delete(usage).where(eq(usage.userId, userId));
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(attachments).where(eq(attachments.userId, userId));
  await db.delete(conversations).where(eq(conversations.userId, userId));
  // projects.user_id → users.id, and conversations.project_id → projects.id,
  // so projects go after conversations and documents, before users.
  await db.delete(projects).where(eq(projects.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function updateUserRole(
  db: Database,
  userId: string,
  role: string,
): Promise<void> {
  const result = await db.update(users).set({ role }).where(eq(users.id, userId));
  if (result.rowCount === 0) throw new Error("user not found");
}

/**
 * Create the operator admin account if it doesn't exist (idempotent). The
 * username is set to the email so login-by-identifier still resolves cleanly.
 */
export async function ensureAdminUser(
  db: Database,
  input: { email: string; passwordHash: string },
): Promise<{ created: boolean }> {
  const existing = await getUserByEmail(db, input.email);
  if (existing) return { created: false };
  const createdAt = new Date();
  await db.insert(users).values({
    id: randomUUID(),
    username: input.email,
    email: input.email,
    passwordHash: input.passwordHash,
    emailVerified: true,
    role: "admin",
    createdAt,
  });
  return { created: true };
}

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    emailVerified: row.emailVerified,
    role: row.role,
    createdAt: row.createdAt,
  };
}
