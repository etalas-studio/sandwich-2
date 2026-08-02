import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/** token is a bearer credential, not just an identifier — generated with randomBytes, not randomUUID. */
export function createSession(db: Database.Database, userId: string, expiresAt: string): Session {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at)
     VALUES (@token, @userId, @createdAt, @expiresAt)`,
  ).run({ token, userId, createdAt, expiresAt });
  return getSessionByToken(db, token)!;
}

export function getSessionByToken(db: Database.Database, token: string): Session | null {
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

interface RawRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

function mapRow(row: RawRow): Session {
  return { token: row.token, userId: row.user_id, createdAt: row.created_at, expiresAt: row.expires_at };
}
