import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Ticket {
  key: string;
  summary: string | null;
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
  worktreePath: string | null;
  branchName: string | null;
  quickWinChoices: string | null;
  quickWinAttempts: number;
  // Informational Jira fields (nullable — pipeline never reads these)
  issueType: string | null;
  priority: string | null;
  sprint: string | null;
  storyPoints: number | null;
  team: string | null;
  assignee: string | null;
  parentKey: string | null;
  attachments: string | null;
  jiraStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  id: string;
  summary?: string;
  description: string;
  url: string | null;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
}

function validate(input: CreateTicketInput): void {
  if (!input.description.trim()) throw new Error("description must not be empty");
}

const nullishNum = (v: unknown): number | null =>
  v === undefined || v === null ? null : Number(v);

function normaliseTicket(row: Record<string, unknown>): Ticket {
  const nullish = (v: unknown) => (v === undefined || v === null ? null : String(v));
  return {
    key: String(row.key),
    summary: nullish(row.summary),
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
    worktreePath: nullish(row.worktree_path),
    branchName: nullish(row.branch_name),
    quickWinChoices: nullish(row.quick_win_choices),
    quickWinAttempts: typeof row.quick_win_attempts === "number" ? row.quick_win_attempts : 0,
    issueType: nullish(row.issue_type),
    priority: nullish(row.priority),
    sprint: nullish(row.sprint),
    storyPoints: nullishNum(row.story_points),
    team: nullish(row.team),
    assignee: nullish(row.assignee),
    parentKey: nullish(row.parent_key),
    attachments: nullish(row.attachments),
    jiraStatus: nullish(row.jira_status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createTicket(db: Database.Database, input: CreateTicketInput): Ticket {
  validate(input);
  const key = input.id.trim() || `T-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tickets (key, summary, description, url, status, created_at, updated_at,
      issue_type, priority, sprint, story_points, team, assignee, parent_key, attachments)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    key,
    input.summary ?? null,
    input.description,
    input.url,
    now,
    now,
    input.issueType ?? null,
    input.priority ?? null,
    input.sprint ?? null,
    input.storyPoints ?? null,
    input.team ?? null,
    input.assignee ?? null,
    input.parentKey ?? null,
    input.attachments ?? null,
  );
  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as Record<string, unknown>;
  return normaliseTicket(row);
}

export function listTickets(db: Database.Database): Ticket[] {
  const rows = db
    .prepare("SELECT * FROM tickets ORDER BY created_at DESC, rowid DESC")
    .all() as Record<string, unknown>[];
  return rows.map(normaliseTicket);
}

export function getTicket(db: Database.Database, key: string): Ticket | null {
  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as
    Record<string, unknown> | undefined;
  if (!row) return null;
  return normaliseTicket(row);
}

export interface UpdateTicketInput {
  description?: string;
  summary?: string | null;
  url?: string | null;
  status?: string;
  stage?: string | null;
  worktreePath?: string | null;
  branchName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  prUrl?: string | null;
  prSummary?: string | null;
  needsHumanCategory?: string | null;
  needsHumanReason?: string | null;
  quickWinChoices?: string | null;
  quickWinAttempts?: number;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
}

export function updateTicket(
  db: Database.Database,
  key: string,
  input: UpdateTicketInput,
): Ticket | null {
  const existing = db.prepare("SELECT key FROM tickets WHERE key = ?").get(key);
  if (!existing) return null;

  const now = new Date().toISOString();
  if (input.description !== undefined) {
    db.prepare("UPDATE tickets SET description = ?, updated_at = ? WHERE key = ?").run(
      input.description,
      now,
      key,
    );
  }
  if (input.summary !== undefined) {
    db.prepare("UPDATE tickets SET summary = ?, updated_at = ? WHERE key = ?").run(
      input.summary,
      now,
      key,
    );
  }
  if (input.url !== undefined) {
    db.prepare("UPDATE tickets SET url = ?, updated_at = ? WHERE key = ?").run(input.url, now, key);
  }
  if (input.status !== undefined) {
    db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE key = ?").run(
      input.status,
      now,
      key,
    );
  }
  if (input.stage !== undefined) {
    db.prepare("UPDATE tickets SET stage = ?, updated_at = ? WHERE key = ?").run(
      input.stage,
      now,
      key,
    );
  }
  if (input.worktreePath !== undefined) {
    db.prepare("UPDATE tickets SET worktree_path = ?, updated_at = ? WHERE key = ?").run(
      input.worktreePath,
      now,
      key,
    );
  }
  if (input.branchName !== undefined) {
    db.prepare("UPDATE tickets SET branch_name = ?, updated_at = ? WHERE key = ?").run(
      input.branchName,
      now,
      key,
    );
  }
  if (input.startedAt !== undefined) {
    db.prepare("UPDATE tickets SET started_at = ?, updated_at = ? WHERE key = ?").run(
      input.startedAt,
      now,
      key,
    );
  }
  if (input.finishedAt !== undefined) {
    db.prepare("UPDATE tickets SET finished_at = ?, updated_at = ? WHERE key = ?").run(
      input.finishedAt,
      now,
      key,
    );
  }
  if (input.prUrl !== undefined) {
    db.prepare("UPDATE tickets SET pr_url = ?, updated_at = ? WHERE key = ?").run(
      input.prUrl,
      now,
      key,
    );
  }
  if (input.prSummary !== undefined) {
    db.prepare("UPDATE tickets SET pr_summary = ?, updated_at = ? WHERE key = ?").run(
      input.prSummary,
      now,
      key,
    );
  }
  if (input.needsHumanCategory !== undefined) {
    db.prepare("UPDATE tickets SET needs_human_category = ?, updated_at = ? WHERE key = ?").run(
      input.needsHumanCategory,
      now,
      key,
    );
  }
  if (input.needsHumanReason !== undefined) {
    db.prepare("UPDATE tickets SET needs_human_reason = ?, updated_at = ? WHERE key = ?").run(
      input.needsHumanReason,
      now,
      key,
    );
  }
  if (input.quickWinChoices !== undefined) {
    db.prepare("UPDATE tickets SET quick_win_choices = ?, updated_at = ? WHERE key = ?").run(
      input.quickWinChoices,
      now,
      key,
    );
  }
  if (input.quickWinAttempts !== undefined) {
    db.prepare("UPDATE tickets SET quick_win_attempts = ?, updated_at = ? WHERE key = ?").run(
      input.quickWinAttempts,
      now,
      key,
    );
  }
  if (input.issueType !== undefined) {
    db.prepare("UPDATE tickets SET issue_type = ?, updated_at = ? WHERE key = ?").run(
      input.issueType,
      now,
      key,
    );
  }
  if (input.priority !== undefined) {
    db.prepare("UPDATE tickets SET priority = ?, updated_at = ? WHERE key = ?").run(
      input.priority,
      now,
      key,
    );
  }
  if (input.sprint !== undefined) {
    db.prepare("UPDATE tickets SET sprint = ?, updated_at = ? WHERE key = ?").run(
      input.sprint,
      now,
      key,
    );
  }
  if (input.storyPoints !== undefined) {
    db.prepare("UPDATE tickets SET story_points = ?, updated_at = ? WHERE key = ?").run(
      input.storyPoints,
      now,
      key,
    );
  }
  if (input.team !== undefined) {
    db.prepare("UPDATE tickets SET team = ?, updated_at = ? WHERE key = ?").run(
      input.team,
      now,
      key,
    );
  }
  if (input.assignee !== undefined) {
    db.prepare("UPDATE tickets SET assignee = ?, updated_at = ? WHERE key = ?").run(
      input.assignee,
      now,
      key,
    );
  }
  if (input.parentKey !== undefined) {
    db.prepare("UPDATE tickets SET parent_key = ?, updated_at = ? WHERE key = ?").run(
      input.parentKey,
      now,
      key,
    );
  }
  if (input.attachments !== undefined) {
    db.prepare("UPDATE tickets SET attachments = ?, updated_at = ? WHERE key = ?").run(
      input.attachments,
      now,
      key,
    );
  }

  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as Record<string, unknown>;
  return normaliseTicket(row);
}

export function deleteTicket(db: Database.Database, key: string): boolean {
  const result = db.prepare("DELETE FROM tickets WHERE key = ?").run(key);
  return result.changes > 0;
}
