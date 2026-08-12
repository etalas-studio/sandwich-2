import type { Migration } from "./types.js";

export const migration0010TicketBranch: Migration = {
  version: 10,
  name: "ticket_branch",
  sql: `
ALTER TABLE tickets ADD COLUMN branch_name TEXT;
`,
};
