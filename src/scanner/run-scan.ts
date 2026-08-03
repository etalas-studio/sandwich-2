import type Database from "better-sqlite3";
import { scanMechanical } from "./mechanical.js";
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
    console.log(`[scan] Mechanical pass starting on: ${repoPath}`);
    let mechanical;
    try {
      mechanical = scanMechanical(repoPath);
      console.log(`[scan] Mechanical pass done: ${mechanical.projectName}, ${mechanical.techStack}, ${mechanical.areaSignals.length} areas`);
    } catch (err) {
      console.error("[scan] Mechanical pass failed:", err);
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

    console.log(`[scan] Complete. Description: ${description ? description.slice(0, 80) + "..." : "(none)"}, ${agentResult.blocklistProposals.length} blocklist entries`);

    completeReadinessScan(db, scanId, {
      projectName: mechanical.projectName,
      description,
      techStack: mechanical.techStack,
      testCommand: mechanical.testCommand,
      areaSignals: mechanical.areaSignals,
    });
  };
}
