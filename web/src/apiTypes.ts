export interface Run {
  id: string;
  ticketKey: string;
  engine: string;
  outcome: string;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  branch: string | null;
  worktreePath: string | null;
  baseCommit: string | null;
  prUrl: string | null;
  prSummary: string | null;
  createdAt: string;
}

export interface Ticket {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
  latestRun: Run | null;
}

/**
 * Ticket-lifecycle column, distinct from the internal per-run pipeline
 * stage (Judge -> Implement -> Verify -> Open PR). A ticket sits in one
 * of these four buckets; while "In progress" it's additionally at one
 * of the internal stages (see stageOf below).
 */
export type Column = "backlog" | "in_progress" | "blocked" | "ready_for_review";

export function columnOf(ticket: Ticket): Column {
  const run = ticket.latestRun;
  if (!run) return "backlog";
  if (run.outcome === "needs_human") return "blocked";
  if (run.outcome === "ready_for_review") return "ready_for_review";
  return "in_progress";
}

export type Stage = "judge" | "implement" | "verify" | "open_pr";

/** Only meaningful while columnOf(ticket) === "in_progress"; ready_for_review implies open_pr. */
export function stageOf(run: Run): Stage {
  if (run.outcome === "judging") return "judge";
  if (run.outcome === "implementing") return "implement";
  if (run.outcome === "verifying") return "verify";
  return "open_pr";
}

export const COLUMN_LABEL: Record<Column, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
  blocked: "Blocked",
  ready_for_review: "Ready for review",
};

export const STAGE_LABEL: Record<Stage, string> = {
  judge: "Judge",
  implement: "Implement",
  verify: "Verify",
  open_pr: "Open PR",
};
