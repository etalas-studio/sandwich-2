import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface NewUser {
  username: string;
  email: string;
  /** Hashing is the Auth piece's responsibility — this module stores an opaque string. */
  passwordHash: string;
}

/**
 * Single row in phase 1, enforced by application logic (the Auth piece),
 * not a schema constraint — the same table shape carries into phase 2's
 * multi-account support without a rewrite.
 */
export function createUser(db: Database.Database, input: NewUser): User {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, created_at)
     VALUES (@id, @username, @email, @passwordHash, @createdAt)`,
  ).run({ id, username: input.username, email: input.email, passwordHash: input.passwordHash, createdAt });
  return getUserById(db, id)!;
}

export function getUserById(db: Database.Database, id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as RawRow | undefined;
  return row ? mapRow(row) : null;
}

export function getUserByUsername(db: Database.Database, username: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

interface RawRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

function mapRow(row: RawRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}
