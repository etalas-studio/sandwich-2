import type Database from "better-sqlite3";
import { assertCleanRepo, createWorktree, removeWorktree } from "../git.js";
import { createEngineInvoker } from "../engine/create-invoker.js";
import type { EngineInvoker } from "../engine/types.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import type { AreaSignal, ReadinessScan } from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";
import { detectTechStack, detectTestCommand, computeAreaSignals } from "./scan-analysis.js";
import { buildBlocklistProposalPrompt, parseBlocklistProposal } from "./scan-prompt.js";
import type { BlocklistProposal } from "./scan-prompt.js";
import type { PipelineConfig } from "./config.js";

type BlocklistProposalOutcome = BlocklistProposal[] | "engine_failed";

interface ScanSignals {
  techStack: string;
  testCommand: string | null;
  areaSignals: AreaSignal[];
}

/**
 * Runs the agent-proposed-blocklist pass inside a throwaway worktree,
 * mirroring how Implement gets scoped shell access (see implement.ts) —
 * never the human's actual checkout. The worktree (and its branch) is
 * always removed, whether the engine call succeeds or fails.
 */
async function proposeBlocklist(
  config: PipelineConfig,
  engineOverride: EngineInvoker | undefined,
  signals: ScanSignals,
  scanId: string,
): Promise<BlocklistProposalOutcome> {
  const branch = `scan/${scanId.slice(0, 8)}`;
  const worktree = await createWorktree(config.repoPath, config.worktreeRoot, branch, config.baseBranch);

  try {
    const engine = engineOverride ?? createEngineInvoker(config.engineMode);
    const result = await engine.run({
      prompt: buildBlocklistProposalPrompt(signals),
      cwd: worktree.path,
      timeoutMs: config.scanTimeoutMs,
    });

    if (result.outcome !== "ok") {
      console.error(
        `Readiness scan ${scanId} blocklist-proposal engine call ended with outcome "${result.outcome}"`,
      );
      return "engine_failed";
    }

    const proposals = parseBlocklistProposal(result.finalText);
    if (proposals.length === 0 && result.finalText.trim().length > 0) {
      console.warn(
        `Readiness scan ${scanId}: could not parse a blocklist proposal from the agent's output — continuing with zero proposed entries.`,
      );
    }
    return proposals;
  } catch (err) {
    console.error(`Readiness scan ${scanId} blocklist-proposal engine call failed:`, err);
    return "engine_failed";
  } finally {
    await removeWorktree(config.repoPath, worktree.path, branch, false).catch((err: unknown) => {
      console.error(`Readiness scan ${scanId} failed to remove its worktree ${worktree.path}:`, err);
    });
  }
}

/**
 * Runs the mechanical analysis + agent-proposed-blocklist pass described in
 * docs/superpowers/specs/2026-08-04-readiness-scan-design.md. Never throws —
 * a failure at any stage records the scan as "failed" and returns it, the
 * same never-throws-outward convention runPipeline follows (see run.ts).
 *
 * `engineOverride` exists purely for testability — real callers omit it and
 * get the engine createEngineInvoker builds from config.engineMode.
 */
export async function runReadinessScan(
  config: PipelineConfig,
  db: Database.Database,
  engineOverride?: EngineInvoker,
): Promise<ReadinessScan> {
  const scan = startReadinessScan(db, new Date().toISOString());

  try {
    await assertCleanRepo(config.repoPath);
    const techStack = detectTechStack(config.repoPath);
    const testCommand = detectTestCommand(config.repoPath);
    const areaSignals = await computeAreaSignals(config.repoPath);

    const proposals = await proposeBlocklist(
      config,
      engineOverride,
      { techStack, testCommand, areaSignals },
      scan.id,
    );
    if (proposals === "engine_failed") {
      return completeReadinessScan(db, scan.id, {
        finishedAt: new Date().toISOString(),
        techStack: null,
        testCommand: null,
        areaSignals: null,
        status: "failed",
      });
    }

    for (const proposal of proposals) {
      insertBlocklistEntry(db, {
        pattern: proposal.pattern,
        reason: proposal.reason,
        source: "agent",
        proposedByScanId: scan.id,
      });
    }

    return completeReadinessScan(db, scan.id, {
      finishedAt: new Date().toISOString(),
      techStack,
      testCommand,
      areaSignals,
      status: "completed",
    });
  } catch (err) {
    console.error(`Readiness scan ${scan.id} failed:`, err);
    return completeReadinessScan(db, scan.id, {
      finishedAt: new Date().toISOString(),
      techStack: null,
      testCommand: null,
      areaSignals: null,
      status: "failed",
    });
  }
}
