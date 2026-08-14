import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { emailVerificationTokens } from "../schema.js";
import { hashToken } from "../../auth/token.js";
import type { Database } from "../connection.js";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EmailVerificationToken {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export async function createVerificationToken(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(emailVerificationTokens).values({
    token: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
    createdAt: now,
  });
  return token;
}

export async function getValidVerificationToken(
  db: Database,
  token: string,
): Promise<EmailVerificationToken | null> {
  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, hashToken(token)))
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

export async function markVerificationTokenUsed(db: Database, token: string): Promise<void> {
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.token, hashToken(token)));
}
