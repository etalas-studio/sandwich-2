import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type ProjectProvider = "github" | "bitbucket";
export type CloneStatus = "cloning" | "ready" | "failed";

export interface Project {
  id: string;
  provider: ProjectProvider;
  owner: string;
  repoSlug: string;
  defaultBranch: string;
  cloneStatus: CloneStatus;
  cloneError: string | null;
  connectedAt: string;
}

export interface CreateProjectInput {
  provider: ProjectProvider;
  owner: string;
  repoSlug: string;
  defaultBranch: string;
}

/**
 * Creates a new project row in 'cloning' status. Callers are expected to
 * have already called clearProject() if a project already exists — this
 * function doesn't enforce that itself (see
 * docs/superpowers/specs/2026-08-04-project-selection-design.md, "Changing
 * projects").
 */
export function createProject(db: Database.Database, input: CreateProjectInput): Project {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO project (id, provider, owner, repo_slug, default_branch, clone_status, clone_error, connected_at)
     VALUES (?, ?, ?, ?, ?, 'cloning', NULL, ?)`,
  ).run(id, input.provider, input.owner, input.repoSlug, input.defaultBranch, now);
  return getById(db, id)!;
}

/**
 * "The current project" — the most recently connected row. In practice
 * there's only ever zero or one row (clearProject deletes before any new
 * connect), but this query doesn't assume that; see the design doc's Data
 * Model section for why.
 */
export function getCurrentProject(db: Database.Database): Project | null {
  const row = db
    .prepare("SELECT * FROM project ORDER BY connected_at DESC, id DESC LIMIT 1")
    .get() as RawRow | undefined;
  return row ? toProject(row) : null;
}

export function markProjectReady(db: Database.Database, id: string): Project {
  db.prepare(
    `UPDATE project SET clone_status = 'ready', clone_error = NULL WHERE id = ?`,
  ).run(id);
  return getById(db, id)!;
}

export function markProjectFailed(db: Database.Database, id: string, error: string): Project {
  db.prepare(
    `UPDATE project SET clone_status = 'failed', clone_error = ? WHERE id = ?`,
  ).run(error, id);
  return getById(db, id)!;
}

/** Deletes every project row. Callers are responsible for removing the
 * clone directory and cascading ticket/blocklist/scan deletes separately
 * (see src/routes/projects.ts). */
export function clearProject(db: Database.Database): void {
  db.prepare("DELETE FROM project").run();
}

// ── internal ──

interface RawRow {
  id: string;
  provider: string;
  owner: string;
  repo_slug: string;
  default_branch: string;
  clone_status: string;
  clone_error: string | null;
  connected_at: string;
}

function getById(db: Database.Database, id: string): Project | null {
  const row = db.prepare("SELECT * FROM project WHERE id = ?").get(id) as RawRow | undefined;
  return row ? toProject(row) : null;
}

function toProject(row: RawRow): Project {
  return {
    id: row.id,
    provider: row.provider as ProjectProvider,
    owner: row.owner,
    repoSlug: row.repo_slug,
    defaultBranch: row.default_branch,
    cloneStatus: row.clone_status as CloneStatus,
    cloneError: row.clone_error,
    connectedAt: row.connected_at,
  };
}
