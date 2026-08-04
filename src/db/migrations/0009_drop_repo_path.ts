import type { Migration } from "./types.js";

export const migration0009DropRepoPath: Migration = {
  version: 9,
  name: "drop_repo_path",
  sql: `
ALTER TABLE instance_settings DROP COLUMN repo_path;
ALTER TABLE instance_settings DROP COLUMN first_run_completed_at;
`,
};
