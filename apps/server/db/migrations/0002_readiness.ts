import type { Migration } from "./types.js";

export const migration0002Readiness: Migration = {
  version: 2,
  name: "readiness-scan",
  sql: `
CREATE TABLE readiness_scans (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  project_name TEXT,
  project_description TEXT,
  tech_stack TEXT,
  test_command TEXT,
  area_signals TEXT,
  recommendations TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE blocklist (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('human', 'agent')),
  proposed_by_scan_id TEXT REFERENCES readiness_scans(id),
  created_at TEXT NOT NULL
);
`,
};
