import type { Migration } from "./types.js";

export const migration0001Init: Migration = {
  version: 1,
  name: "init",
  sql: `
CREATE TABLE tickets (
  key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  ticket_key TEXT NOT NULL REFERENCES tickets(key),
  engine TEXT NOT NULL,
  outcome TEXT NOT NULL,
  needs_human_category TEXT,
  needs_human_reason TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  branch TEXT,
  worktree_path TEXT,
  base_commit TEXT,
  pr_url TEXT,
  pr_summary TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_runs_ticket_key ON runs(ticket_key);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
  merge_outcome TEXT NOT NULL,
  edit_effort TEXT NOT NULL,
  review_rounds INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE readiness_scans (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  tech_stack TEXT,
  test_command TEXT,
  area_signals TEXT,
  status TEXT NOT NULL
);

CREATE TABLE blocklist_entries (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  proposed_by_scan_id TEXT REFERENCES readiness_scans(id),
  created_at TEXT NOT NULL
);

CREATE TABLE credentials (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE instance_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  repo_path TEXT,
  first_run_completed_at TEXT
);
INSERT OR IGNORE INTO instance_settings (id) VALUES (1);
`,
};
