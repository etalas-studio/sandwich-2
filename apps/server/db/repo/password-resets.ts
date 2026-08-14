import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { passwordResetTokens } from "../schema.js";
import { hashToken } from "../../auth/token.js";
import type { Database } from "../connection.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export async function createResetToken(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(passwordResetTokens).values({
    token: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    createdAt: now,
  });
  return token;
}

export async function getValidResetToken(
  db: Database,
  token: string,
): Promise<PasswordResetToken | null> {
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, hashToken(token)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0]!;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return {
    token: row.token,
    userId: row.userId,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  };
}

export async function markResetTokenUsed(db: Database, token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, hashToken(token)));
}
