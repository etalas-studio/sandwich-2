import type { Migration } from "./types.js";

export const migration0015TicketFeedback: Migration = {
  version: 15,
  name: "ticket_feedback",
  sql: `
ALTER TABLE tickets ADD COLUMN feedback TEXT;
`,
};
