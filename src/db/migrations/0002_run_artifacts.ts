import type { Migration } from "./types.js";

export const migration0002RunArtifacts: Migration = {
  version: 2,
  name: "run_artifacts",
  sql: `
CREATE TABLE run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_run_artifacts_run_id ON run_artifacts(run_id);
`,
};
