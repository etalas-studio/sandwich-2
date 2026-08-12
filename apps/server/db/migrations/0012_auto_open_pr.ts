import type { Migration } from "./types.js";

export const migration0012AutoOpenPr: Migration = {
  version: 12,
  name: "auto_open_pr",
  sql: `
ALTER TABLE project ADD COLUMN auto_open_pr INTEGER NOT NULL DEFAULT 1;
`,
};
