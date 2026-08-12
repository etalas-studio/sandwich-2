import type { Migration } from "./types.js";

export const migration0016PrColumns: Migration = {
  version: 16,
  name: "pr_columns",
  sql: `
ALTER TABLE tickets ADD COLUMN pr_title TEXT;
ALTER TABLE tickets ADD COLUMN pr_description TEXT;
`,
};
