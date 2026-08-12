import type { Migration } from "./types.js";

export const migration0013AddPrContentColumns: Migration = {
  version: 13,
  name: "add_pr_content_columns",
  sql: `
ALTER TABLE tickets ADD COLUMN pr_title TEXT;
ALTER TABLE tickets ADD COLUMN pr_description TEXT;
`,
};
