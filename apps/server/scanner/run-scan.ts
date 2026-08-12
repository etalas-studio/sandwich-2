import type Database from "better-sqlite3";
import { scanMechanical, computeAreaSignalsForPaths } from "./mechanical.js";
import { runAgentPass } from "./agent-pass.js";
import { completeReadinessScan, abortReadinessScan } from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";

export type InvokerFactory = (modelId: string | null) => {
  run: (opts: {
    prompt: string;
    cwd: string;
    timeoutMs: number;
  }) => Promise<{ outcome: string; finalText: string }>;
};

export function createScanRunner(
  db: Database.Database,
  createInvoker: InvokerFactory,
): (
  scanId: string,
  repoPath: string,
  signal: AbortSignal,
  modelId: string | null,
) => Promise<void> {
  return async (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => {
    // Mechanical pass (synchronous, fast)
    let mechanical;
    try {
      mechanical = scanMechanical(repoPath);
      console.log(
        "[scan:runner] mechanical pass ok, techStack =",
        mechanical.techStack,
        "testCommand =",
        mechanical.testCommand,
        "areaSignals =",
        mechanical.areaSignals.length,
        "areas",
      );
    } catch (err) {
      console.error("[scan:runner] mechanical pass failed:", err);
      abortReadinessScan(db, scanId);
      return;
    }

    if (signal.aborted) {
      console.log("[scan:runner] aborted after mechanical pass");
      abortReadinessScan(db, scanId);
      return;
    }

    console.log("[scan:runner] creating invoker with modelId =", modelId);
    const invoker = createInvoker(modelId);

    console.log("[scan:runner] starting agent pass...");
    const agentResult = await runAgentPass({
      repoPath,
      mechanicalResult: mechanical,
      signal,
      invoker,
    });
    console.log(
      "[scan:runner] agent pass done, outcome =",
      agentResult.outcome,
      "areas =",
      agentResult.areas.length,
      "description =",
      agentResult.description?.slice(0, 80),
    );

    if (agentResult.outcome === "aborted") {
      abortReadinessScan(db, scanId);
      return;
    }

    // If the agent pass failed (timeout, error, etc.), still complete the scan
    // but only with mechanical data so the user can see it wasn't a full analysis.
    const agentFailed = agentResult.outcome !== "ok";

    for (const proposal of agentResult.blocklistProposals) {
      insertBlocklistEntry(db, {
        pattern: proposal.pattern,
        reason: proposal.reason,
        source: "agent",
        proposedByScanId: scanId,
      });
    }

    const description = agentResult.description;

    // Use AI-defined areas if available, fall back to top-level directory scan
    const areaSignals =
      agentResult.areas.length > 0
        ? computeAreaSignalsForPaths(repoPath, agentResult.areas)
        : mechanical.areaSignals;

    // When the agent pass fails, attach the outcome to the description so
    // the user can see it wasn't a full AI analysis.
    const finalDescription = agentFailed
      ? (description ?? mechanical.description ?? `[Agent pass failed: ${agentResult.outcome}]`)
      : description;

    completeReadinessScan(db, scanId, {
      projectName: agentResult.projectName ?? mechanical.projectName,
      description: finalDescription,
      techStack: mechanical.techStack,
      testCommand: mechanical.testCommand,
      areaSignals,
      recommendations: agentFailed ? [] : agentResult.recommendations,
    });
  };
}
