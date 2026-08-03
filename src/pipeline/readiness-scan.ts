import type Database from "better-sqlite3";
import { createWorktree, removeWorktree } from "../git.js";
import { createEngineInvoker } from "../engine/create-invoker.js";
import type { EngineInvoker } from "../engine/types.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import type { AreaSignal, ReadinessScan } from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";
import {
  detectTechStack,
  detectTestCommand,
  detectAgentContextFile,
  detectReadme,
  detectCI,
  computeAreaSignals,
} from "./scan-analysis.js";
import { buildScanAssessmentPrompt, parseScanAssessment } from "./scan-prompt.js";
import type { ScanAssessment } from "./scan-prompt.js";
import { buildRecommendations } from "./scan-recommendations.js";
import type { PipelineConfig } from "./config.js";

type ScanAssessmentOutcome = ScanAssessment | "engine_failed";

interface ScanSignals {
  techStack: string;
  testCommand: string | null;
  areaSignals: AreaSignal[];
}

/**
 * Runs the agent assessment pass (codebase summary, agentic-workflow
 * assessment, blocklist proposal) inside a throwaway worktree, mirroring
 * how Implement gets scoped shell access (see implement.ts) — never the
 * human's actual checkout. The worktree (and its branch) is always
 * removed, whether the engine call succeeds or fails.
 */
async function runScanAssessment(
  config: PipelineConfig,
  engineOverride: EngineInvoker | undefined,
  signals: ScanSignals,
  scanId: string,
): Promise<ScanAssessmentOutcome> {
  const branch = `scan/${scanId.slice(0, 8)}`;
  const worktree = await createWorktree(config.repoPath, config.worktreeRoot, branch, config.baseBranch);

  try {
    const engine = engineOverride ?? createEngineInvoker(config.engineMode);
    const result = await engine.run({
      prompt: buildScanAssessmentPrompt(signals),
      cwd: worktree.path,
      timeoutMs: config.scanTimeoutMs,
    });

    if (result.outcome !== "ok") {
      console.error(`Readiness scan ${scanId} assessment engine call ended with outcome "${result.outcome}"`);
      return "engine_failed";
    }

    const assessment = parseScanAssessment(result.finalText);
    if (assessment === null) {
      console.warn(
        `Readiness scan ${scanId}: could not parse an assessment from the agent's output — continuing with no summary and zero proposed blocklist entries.`,
      );
      return { codebaseSummary: null, agenticFlowSummary: null, blocklist: [] };
    }
    return assessment;
  } catch (err) {
    console.error(`Readiness scan ${scanId} assessment engine call failed:`, err);
    return "engine_failed";
  } finally {
    await removeWorktree(config.repoPath, worktree.path, branch, false).catch((err: unknown) => {
      console.error(`Readiness scan ${scanId} failed to remove its worktree ${worktree.path}:`, err);
    });
  }
}

/**
 * Runs the mechanical analysis + agent assessment pass described in
 * docs/superpowers/specs/2026-08-04-readiness-scan-design.md. Never throws —
 * a failure at any stage records the scan as "failed" and returns it, the
 * same never-throws-outward convention runPipeline follows (see run.ts).
 *
 * Deliberately does NOT require a clean main checkout (unlike runPipeline)
 * — a scan never touches it: mechanical analysis is read-only, and the
 * agent pass runs inside its own throwaway worktree via createWorktree,
 * which branches off a specific commit regardless of the working tree's
 * state. Requiring a spotless repo before every scan would fight the
 * feature's own premise (a cheap, frequently-run check).
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
    const techStack = detectTechStack(config.repoPath);
    const testCommand = detectTestCommand(config.repoPath);
    const areaSignals = await computeAreaSignals(config.repoPath);
    const agentContextFile = detectAgentContextFile(config.repoPath);
    const readme = detectReadme(config.repoPath);
    const hasCI = detectCI(config.repoPath);

    const assessment = await runScanAssessment(
      config,
      engineOverride,
      { techStack, testCommand, areaSignals },
      scan.id,
    );
    if (assessment === "engine_failed") {
      return completeReadinessScan(db, scan.id, {
        finishedAt: new Date().toISOString(),
        techStack: null,
        testCommand: null,
        areaSignals: null,
        recommendations: null,
        codebaseSummary: null,
        agenticFlowSummary: null,
        status: "failed",
      });
    }

    for (const proposal of assessment.blocklist) {
      insertBlocklistEntry(db, {
        pattern: proposal.pattern,
        reason: proposal.reason,
        source: "agent",
        proposedByScanId: scan.id,
      });
    }

    const recommendations = buildRecommendations({
      testCommand,
      areaSignals,
      agentContextFile,
      readme,
      hasCI,
    });

    return completeReadinessScan(db, scan.id, {
      finishedAt: new Date().toISOString(),
      techStack,
      testCommand,
      areaSignals,
      recommendations,
      codebaseSummary: assessment.codebaseSummary,
      agenticFlowSummary: assessment.agenticFlowSummary,
      status: "completed",
    });
  } catch (err) {
    console.error(`Readiness scan ${scan.id} failed:`, err);
    return completeReadinessScan(db, scan.id, {
      finishedAt: new Date().toISOString(),
      techStack: null,
      testCommand: null,
      areaSignals: null,
      recommendations: null,
      codebaseSummary: null,
      agenticFlowSummary: null,
      status: "failed",
    });
  }
}
