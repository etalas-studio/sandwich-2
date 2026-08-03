import type { Migration } from "./types.js";

export const migration0003Tickets: Migration = {
  version: 3,
  name: "tickets",
  sql: `
CREATE TABLE tickets (
  key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  stage TEXT,
  needs_human_category TEXT,
  needs_human_reason TEXT,
  pr_url TEXT,
  pr_summary TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
};
