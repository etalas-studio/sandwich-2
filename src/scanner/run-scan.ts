import type Database from "better-sqlite3";
import { scanMechanical, computeAreaSignalsForPaths } from "./mechanical.js";
import { runAgentPass } from "./agent-pass.js";
import {
  completeReadinessScan,
  abortReadinessScan,
} from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";

export type InvokerFactory = (
  modelId: string | null,
) => {
  run: (opts: { prompt: string; cwd: string; timeoutMs: number }) => Promise<{ outcome: string; finalText: string }>;
};

export function createScanRunner(
  db: Database.Database,
  createInvoker: InvokerFactory,
): (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void> {
  return async (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => {
    // Mechanical pass (synchronous, fast)
    let mechanical;
    try {
      mechanical = scanMechanical(repoPath);
    } catch (err) {
      abortReadinessScan(db, scanId);
      return;
    }

    if (signal.aborted) {
      abortReadinessScan(db, scanId);
      return;
    }

    const invoker = createInvoker(modelId);

    const agentResult = await runAgentPass({
      repoPath,
      mechanicalResult: mechanical,
      signal,
      invoker,
    });

    if (agentResult.outcome === "aborted") {
      abortReadinessScan(db, scanId);
      return;
    }

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

    completeReadinessScan(db, scanId, {
      projectName: mechanical.projectName,
      description,
      techStack: mechanical.techStack,
      testCommand: mechanical.testCommand,
      areaSignals,
    });
  };
}
