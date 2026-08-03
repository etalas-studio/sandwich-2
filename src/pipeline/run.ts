import type Database from "better-sqlite3";
import { getTicketByKey } from "../db/tickets.js";
import { insertRun, updateRun } from "../db/runs.js";
import type { Run } from "../db/runs.js";
import { assertCleanRepo, createWorktree } from "../git.js";
import { createEngineInvoker } from "../engine/create-invoker.js";
import type { EngineInvoker } from "../engine/types.js";
import { judge } from "./judge.js";
import { implement } from "./implement.js";
import { verify } from "./verify.js";
import type { PipelineConfig } from "./config.js";
import type { PipelineContext } from "./types.js";

/**
 * Runs Judge -> Implement -> Verify for one ticket against one freshly
 * created worktree, persisting to the `runs` row after every stage
 * transition. Stops (without error) as soon as a stage produces anything
 * other than "keep going" — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md.
 *
 * `engineOverride` exists purely for testability (see run.test.ts) — real
 * callers omit it and get the engine createEngineInvoker builds from
 * config.engineMode.
 *
 * `signal` lets a human stop an in-flight run from the UI. Omitted callers
 * (including every existing test) get a signal that's never aborted, so
 * this is purely additive.
 */
export async function runPipeline(
  ticketKey: string,
  config: PipelineConfig,
  db: Database.Database,
  engineOverride?: EngineInvoker,
  signal?: AbortSignal,
): Promise<Run> {
  const ticket = getTicketByKey(db, ticketKey);
  if (!ticket) {
    throw new Error(`No ticket found with key "${ticketKey}"`);
  }

  const engineName = `claude-code-${config.engineMode}`;
  const run = insertRun(db, {
    ticketKey,
    engine: engineName,
    outcome: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    await assertCleanRepo(config.repoPath);
    const branch = `${config.branchPrefix}${ticket.key}-${run.id.slice(0, 8)}`;
    const worktree = await createWorktree(
      config.repoPath,
      config.worktreeRoot,
      branch,
      config.baseBranch,
    );
    updateRun(db, run.id, {
      branch: worktree.branch,
      worktreePath: worktree.path,
      baseCommit: worktree.baseCommit,
    });

    const engine = engineOverride ?? createEngineInvoker(config.engineMode);
    const ctx: PipelineContext = {
      db,
      runId: run.id,
      ticket,
      engine,
      engineName,
      worktreePath: worktree.path,
      baseCommit: worktree.baseCommit,
      implementTimeoutMs: config.implementTimeoutMs,
      verifyTimeoutMs: config.verifyTimeoutMs,
      signal: signal ?? new AbortController().signal,
    };

    const j = await judge(ctx);
    updateRun(db, run.id, { outcome: j.outcome });
    if (j.outcome !== "agent_ready") {
      return updateRun(db, run.id, { finishedAt: new Date().toISOString() });
    }

    const i = await implement(ctx);
    updateRun(db, run.id, {
      outcome: i.outcome,
      needsHumanCategory: i.needsHumanCategory,
      needsHumanReason: i.needsHumanReason,
    });
    if (i.outcome !== "changes_committed") {
      return updateRun(db, run.id, { finishedAt: new Date().toISOString() });
    }

    const v = await verify(ctx);
    return updateRun(db, run.id, {
      outcome: v.outcome,
      needsHumanCategory: v.needsHumanCategory,
      needsHumanReason: v.needsHumanReason,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    return updateRun(db, run.id, {
      outcome: "error",
      needsHumanReason: err instanceof Error ? err.message : String(err),
      finishedAt: new Date().toISOString(),
    });
  }
}
