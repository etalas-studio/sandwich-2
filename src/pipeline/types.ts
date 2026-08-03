import type Database from "better-sqlite3";
import type { EngineInvoker } from "../engine/types.js";
import type { Ticket } from "../db/tickets.js";

/**
 * Everything a pipeline stage needs to do its job. Built once per run by
 * the orchestrator (run.ts) and passed unchanged to judge(), implement(),
 * and verify() — they all operate on the same worktree/db/run.
 */
export interface PipelineContext {
  db: Database.Database;
  runId: string;
  ticket: Ticket;
  engine: EngineInvoker;
  /** e.g. "claude-code-pty" — stored verbatim in runs.engine. */
  engineName: string;
  worktreePath: string;
  baseCommit: string;
  implementTimeoutMs: number;
  verifyTimeoutMs: number;
}

/**
 * The Phase 1 spec's fixed needs-human vocabulary. Only populated for stops
 * that map onto one of these with a straight face — see the design doc's
 * "Outcome model" section for which stops get null instead.
 */
export type NeedsHumanCategory =
  | "ambiguous_ticket"
  | "forbidden_path_or_action"
  | "weak_verification"
  | "missing_context";

/**
 * Judge is stubbed in this plan (see judge.ts) — it always returns
 * agent_ready, so this type only models that one outcome for now. Real
 * Judge logic (once the readiness-scan piece exists) will need to widen
 * this to include a needs-human path with a category.
 */
export interface JudgeResult {
  outcome: "agent_ready";
}

export type ImplementOutcome =
  | "changes_committed"
  | "no_changes"
  | "needs_human"
  | "implement_timeout"
  | "implement_error"
  | "implement_nonzero_exit";

export interface ImplementResult {
  outcome: ImplementOutcome;
  needsHumanCategory: NeedsHumanCategory | null;
  needsHumanReason: string | null;
}

export type VerifyOutcome = "ready_for_pr" | "needs_human" | "verify_failed" | "verify_timeout";

export interface VerifyResult {
  outcome: VerifyOutcome;
  needsHumanCategory: NeedsHumanCategory | null;
  needsHumanReason: string | null;
}
