import type { Migration } from "./types.js";

export const migration0011JiraStatus: Migration = {
  version: 11,
  name: "jira_status",
  sql: `
ALTER TABLE tickets ADD COLUMN jira_status TEXT;
`,
};
