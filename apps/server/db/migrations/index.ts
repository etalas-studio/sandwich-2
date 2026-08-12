import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002Readiness } from "./0002_readiness.js";
import { migration0003Tickets } from "./0003_tickets.js";
import { migration0004TicketWorktree } from "./0004_ticket_worktree.js";
import { migration0006QuickWin } from "./0006_quick_win.js";
import { migration0007JiraFields } from "./0007_jira_fields.js";
import { migration0008ProjectProvider } from "./0008_project_provider.js";
import { migration0009DropRepoPath } from "./0009_drop_repo_path.js";
import { migration0010TicketBranch } from "./0010_ticket_branch.js";
import { migration0011JiraStatus } from "./0011_jira_status.js";
import { migration0012AutoOpenPr } from "./0012_auto_open_pr.js";
import { migration0013AddPrContentColumns } from "./0013_add_pr_content_columns.js";
import { migration0014Payments } from "./0014_payments.js";
import { migration0015TicketFeedback } from "./0015_ticket_feedback.js";

export const MIGRATIONS: Migration[] = [
  migration0001Init,
  migration0002Readiness,
  migration0003Tickets,
  migration0004TicketWorktree,
  migration0006QuickWin,
  migration0007JiraFields,
  migration0008ProjectProvider,
  migration0009DropRepoPath,
  migration0010TicketBranch,
  migration0011JiraStatus,
  migration0012AutoOpenPr,
  migration0013AddPrContentColumns,
  migration0014Payments,
  migration0015TicketFeedback,
];
