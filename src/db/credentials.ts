import type Database from "better-sqlite3";

export interface Credential {
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Populated only once a human provides a value through the UI form
 * described in the product spec — the "blocker" state itself is just a
 * run's needs_human_category/needs_human_reason, not a row here.
 */
export function upsertCredential(db: Database.Database, name: string, value: string): Credential {
  const now = new Date().toISOString();
  const existing = getCredential(db, name);
  const createdAt = existing?.createdAt ?? now;

  db.prepare(
    `INSERT INTO credentials (name, value, created_at, updated_at)
     VALUES (@name, @value, @createdAt, @updatedAt)
     ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run({ name, value, createdAt, updatedAt: now });

  return getCredential(db, name)!;
}

export function getCredential(db: Database.Database, name: string): Credential | null {
  const row = db.prepare("SELECT * FROM credentials WHERE name = ?").get(name) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

/** Names only, never values — for listing "known credentials" in a UI without displaying secrets. */
export function listCredentialNames(db: Database.Database): string[] {
  const rows = db.prepare("SELECT name FROM credentials ORDER BY name").all() as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}

interface RawRow {
  name: string;
  value: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawRow): Credential {
  return { name: row.name, value: row.value, createdAt: row.created_at, updatedAt: row.updated_at };
}
