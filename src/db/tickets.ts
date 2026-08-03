import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Ticket {
  key: string;
  description: string;
  url: string | null;
  status: string;
  stage: string | null;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  prUrl: string | null;
  prSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  id: string;        // optional — auto-generated if empty
  description: string;
  url: string | null;
}

function validate(input: CreateTicketInput): void {
  if (!input.description.trim()) throw new Error("description must not be empty");
}

/** Normalise better-sqlite3 NULL → null (the driver can return undefined). */
function normaliseTicket(row: Record<string, unknown>): Ticket {
  const nullish = (v: unknown) => (v === undefined || v === null ? null : String(v));
  return {
    key: String(row.key),
    description: String(row.description),
    url: nullish(row.url),
    status: String(row.status),
    stage: nullish(row.stage),
    needsHumanCategory: nullish(row.needs_human_category),
    needsHumanReason: nullish(row.needs_human_reason),
    prUrl: nullish(row.pr_url),
    prSummary: nullish(row.pr_summary),
    startedAt: nullish(row.started_at),
    finishedAt: nullish(row.finished_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createTicket(db: Database.Database, input: CreateTicketInput): Ticket {
  validate(input);
  const key = input.id.trim() || `T-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tickets (key, description, url, status, created_at, updated_at)
     VALUES (?, ?, ?, 'backlog', ?, ?)`,
  ).run(key, input.description, input.url, now, now);
  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as Record<string, unknown>;
  return normaliseTicket(row);
}

export function listTickets(db: Database.Database): Ticket[] {
  const rows = db.prepare("SELECT * FROM tickets ORDER BY created_at DESC, rowid DESC").all() as Record<string, unknown>[];
  return rows.map(normaliseTicket);
}
