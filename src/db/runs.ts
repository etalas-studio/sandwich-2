import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Run {
  id: string;
  ticketKey: string;
  engine: string;
  outcome: string;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  branch: string | null;
  worktreePath: string | null;
  baseCommit: string | null;
  prUrl: string | null;
  prSummary: string | null;
  createdAt: string;
}

export interface NewRun {
  ticketKey: string;
  engine: string;
  /**
   * The exact set of valid outcome strings is finalized by the Pipeline
   * shape piece — this module persists whatever string it's given.
   */
  outcome: string;
  startedAt: string;
}

/** One row per attempt — a ticket can have more than one run over time. */
export function insertRun(db: Database.Database, input: NewRun): Run {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO runs (id, ticket_key, engine, outcome, started_at, created_at)
     VALUES (@id, @ticketKey, @engine, @outcome, @startedAt, @createdAt)`,
  ).run({
    id,
    ticketKey: input.ticketKey,
    engine: input.engine,
    outcome: input.outcome,
    startedAt: input.startedAt,
    createdAt,
  });

  return getRunById(db, id)!;
}

export interface RunUpdate {
  outcome?: string;
  needsHumanCategory?: string | null;
  needsHumanReason?: string | null;
  finishedAt?: string;
  branch?: string;
  worktreePath?: string;
  baseCommit?: string;
  prUrl?: string;
  prSummary?: string;
}

/** Partial update — fields not present in `update` keep their current value. */
export function updateRun(db: Database.Database, id: string, update: RunUpdate): Run {
  const current = getRunById(db, id);
  if (!current) {
    throw new Error(`No run found with id ${id}`);
  }

  const merged = {
    outcome: update.outcome ?? current.outcome,
    needsHumanCategory:
      update.needsHumanCategory !== undefined
        ? update.needsHumanCategory
        : current.needsHumanCategory,
    needsHumanReason:
      update.needsHumanReason !== undefined ? update.needsHumanReason : current.needsHumanReason,
    finishedAt: update.finishedAt ?? current.finishedAt,
    branch: update.branch ?? current.branch,
    worktreePath: update.worktreePath ?? current.worktreePath,
    baseCommit: update.baseCommit ?? current.baseCommit,
    prUrl: update.prUrl ?? current.prUrl,
    prSummary: update.prSummary ?? current.prSummary,
  };

  db.prepare(
    `UPDATE runs SET
       outcome = @outcome,
       needs_human_category = @needsHumanCategory,
       needs_human_reason = @needsHumanReason,
       finished_at = @finishedAt,
       branch = @branch,
       worktree_path = @worktreePath,
       base_commit = @baseCommit,
       pr_url = @prUrl,
       pr_summary = @prSummary
     WHERE id = @id`,
  ).run({ id, ...merged });

  return getRunById(db, id)!;
}

export function getRunById(db: Database.Database, id: string): Run | null {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RawRunRow | undefined;
  return row ? mapRow(row) : null;
}

export function listRunsForTicket(db: Database.Database, ticketKey: string): Run[] {
  const rows = db
    .prepare("SELECT * FROM runs WHERE ticket_key = ? ORDER BY started_at")
    .all(ticketKey) as RawRunRow[];
  return rows.map(mapRow);
}

interface RawRunRow {
  id: string;
  ticket_key: string;
  engine: string;
  outcome: string;
  needs_human_category: string | null;
  needs_human_reason: string | null;
  started_at: string;
  finished_at: string | null;
  branch: string | null;
  worktree_path: string | null;
  base_commit: string | null;
  pr_url: string | null;
  pr_summary: string | null;
  created_at: string;
}

function mapRow(row: RawRunRow): Run {
  return {
    id: row.id,
    ticketKey: row.ticket_key,
    engine: row.engine,
    outcome: row.outcome,
    needsHumanCategory: row.needs_human_category,
    needsHumanReason: row.needs_human_reason,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    branch: row.branch,
    worktreePath: row.worktree_path,
    baseCommit: row.base_commit,
    prUrl: row.pr_url,
    prSummary: row.pr_summary,
    createdAt: row.created_at,
  };
}
