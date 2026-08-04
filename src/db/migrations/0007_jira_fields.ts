import type { Migration } from "./types.js";

export const migration0007JiraFields: Migration = {
  version: 7,
  name: "jira_fields",
  sql: `
ALTER TABLE tickets ADD COLUMN issue_type TEXT;
ALTER TABLE tickets ADD COLUMN priority TEXT;
ALTER TABLE tickets ADD COLUMN sprint TEXT;
ALTER TABLE tickets ADD COLUMN story_points REAL;
ALTER TABLE tickets ADD COLUMN team TEXT;
ALTER TABLE tickets ADD COLUMN assignee TEXT;
ALTER TABLE tickets ADD COLUMN parent_key TEXT;
ALTER TABLE tickets ADD COLUMN attachments TEXT;
`,
};
