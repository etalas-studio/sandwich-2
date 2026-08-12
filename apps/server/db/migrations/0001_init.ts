import type { Migration } from "./types.js";

export const migration0001Init: Migration = {
  version: 1,
  name: "init",
  sql: `
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
