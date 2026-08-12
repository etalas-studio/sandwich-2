import type { Migration } from "./types.js";

export const migration0008ProjectProvider: Migration = {
  version: 8,
  name: "project_provider",
  sql: `
CREATE TABLE project (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'bitbucket')),
  owner TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  clone_status TEXT NOT NULL DEFAULT 'cloning' CHECK (clone_status IN ('cloning', 'ready', 'failed')),
  clone_error TEXT,
  connected_at TEXT NOT NULL
);
`,
};
