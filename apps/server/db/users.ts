import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { users } from "./schema.js";
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
