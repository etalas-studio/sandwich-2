import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0003Tickets } from "./0003_tickets.js";
import { migration0004TicketWorktree } from "./0004_ticket_worktree.js";
import { migration0007JiraFields } from "./0007_jira_fields.js";
import { migration0010TicketBranch } from "./0010_ticket_branch.js";
import { migration0011JiraStatus } from "./0011_jira_status.js";
import { migration0014Payments } from "./0014_payments.js";
import { migration0015TicketFeedback } from "./0015_ticket_feedback.js";

export const MIGRATIONS: Migration[] = [
  migration0001Init,
  migration0003Tickets,
  migration0004TicketWorktree,
  migration0007JiraFields,
  migration0010TicketBranch,
  migration0011JiraStatus,
  migration0014Payments,
  migration0015TicketFeedback,
];
