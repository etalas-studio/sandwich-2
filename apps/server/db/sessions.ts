import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { sessions } from "./schema.js";
import type { Database } from "./connection.js";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export async function createSession(db: Database, userId: string, expiresAt: string): Promise<Session> {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  await db.insert(sessions).values({ token, userId, createdAt, expiresAt });
  return (await getSessionByToken(db, token))!;
}

export async function getSessionByToken(db: Database, token: string): Promise<Session | null> {
  const rows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  if (rows.length === 0) return null;
  return mapSession(rows[0]!);
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

function mapSession(row: typeof sessions.$inferSelect): Session {
  return {
    token: row.token,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
