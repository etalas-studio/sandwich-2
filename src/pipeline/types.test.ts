import type Database from "better-sqlite3";
import type { EngineInvoker } from "../engine/types.js";
import type { Ticket } from "../db/tickets.js";
import type {
  PipelineContext,
  JudgeResult,
  ImplementResult,
  VerifyResult,
  NeedsHumanCategory,
} from "./types.js";

// This file has no runtime assertions — it's a compile-time check that
// every pipeline type is actually constructible/consumable as designed.
// If this file fails to typecheck, that's the test failing.

const fakeTicket: Ticket = {
  key: "PROJ-1",
  summary: "s",
  description: "d",
  url: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const fakeEngine: EngineInvoker = {
  async run() {
    return { outcome: "ok", finalText: "", transcript: [], durationSec: 0, exitCode: 0 };
  },
};

function checkContextShape(db: Database.Database): PipelineContext {
  return {
    db,
    runId: "run-1",
    ticket: fakeTicket,
    engine: fakeEngine,
    engineName: "claude-code-pty",
    worktreePath: "/tmp/example",
    baseCommit: "abc123",
    implementTimeoutMs: 1000,
    verifyTimeoutMs: 1000,
  };
}

const judgeResult: JudgeResult = { outcome: "agent_ready" };

const changesCommitted: ImplementResult = {
  outcome: "changes_committed",
  needsHumanCategory: null,
  needsHumanReason: null,
};

const forbiddenPath: ImplementResult = {
  outcome: "needs_human",
  needsHumanCategory: "forbidden_path_or_action",
  needsHumanReason: "matched a blocklist entry",
};

const readyForPr: VerifyResult = {
  outcome: "ready_for_pr",
  needsHumanCategory: null,
  needsHumanReason: null,
};

const weakVerification: VerifyResult = {
  outcome: "needs_human",
  needsHumanCategory: "weak_verification",
  needsHumanReason: "no test command known",
};

const allCategories: NeedsHumanCategory[] = [
  "ambiguous_ticket",
  "forbidden_path_or_action",
  "weak_verification",
  "missing_context",
];

console.log(
  "PASS: pipeline types are constructible",
  checkContextShape.name,
  judgeResult,
  changesCommitted,
  forbiddenPath,
  readyForPr,
  weakVerification,
  allCategories.length,
);
