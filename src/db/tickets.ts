import type Database from "better-sqlite3";

export interface Ticket {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  key: string;
  summary: string;
  description: string;
  url?: string | null;
}

/**
 * Upserted whenever the ticket queue file is read, so a ticket's details
 * stay attached to its run history even if it's later removed from the
 * queue file. created_at is preserved across updates; updated_at always
 * reflects the latest write.
 */
export function upsertTicket(db: Database.Database, input: TicketInput): Ticket {
  const now = new Date().toISOString();
  const existing = getTicketByKey(db, input.key);
  const createdAt = existing?.createdAt ?? now;

  db.prepare(
    `INSERT INTO tickets (key, summary, description, url, created_at, updated_at)
     VALUES (@key, @summary, @description, @url, @createdAt, @updatedAt)
     ON CONFLICT(key) DO UPDATE SET
       summary = excluded.summary,
       description = excluded.description,
       url = excluded.url,
       updated_at = excluded.updated_at`,
  ).run({
    key: input.key,
    summary: input.summary,
    description: input.description,
    url: input.url ?? null,
    createdAt,
    updatedAt: now,
  });

  return getTicketByKey(db, input.key)!;
}

export function getTicketByKey(db: Database.Database, key: string): Ticket | null {
  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as
    | RawTicketRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function listTickets(db: Database.Database): Ticket[] {
  const rows = db.prepare("SELECT * FROM tickets ORDER BY created_at").all() as RawTicketRow[];
  return rows.map(mapRow);
}

interface RawTicketRow {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawTicketRow): Ticket {
  return {
    key: row.key,
    summary: row.summary,
    description: row.description,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
