import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { users } from "./schema.js";
import type { Database } from "./connection.js";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
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

export async function updatePassword(db: Database, userId: string, newPasswordHash: string): Promise<void> {
  const result = await db.update(users)
    .set({ passwordHash: newPasswordHash })
    .where(eq(users.id, userId));
  if (result.rowCount === 0) throw new Error("user not found");
}

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}
