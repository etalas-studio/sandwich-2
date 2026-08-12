import type { Migration } from "./types.js";

export const migration0004TicketWorktree: Migration = {
  version: 4,
  name: "ticket_worktree",
  sql: `
ALTER TABLE tickets ADD COLUMN worktree_path TEXT;
`,
};
