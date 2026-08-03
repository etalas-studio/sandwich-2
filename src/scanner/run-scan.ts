import type Database from "better-sqlite3";
import { scanMechanical } from "./mechanical.js";
import { runAgentPass } from "./agent-pass.js";
import {
  completeReadinessScan,
  abortReadinessScan,
} from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";

export function createScanRunner(
  db: Database.Database,
  invoker: {
    run: (opts: {
      prompt: string;
      cwd: string;
      timeoutMs: number;
    }) => Promise<{ outcome: string; finalText: string }>;
  },
): (scanId: string, repoPath: string, signal: AbortSignal) => Promise<void> {
  return async (scanId: string, repoPath: string, signal: AbortSignal) => {
    // Mechanical pass (synchronous, fast)
    let mechanical;
    try {
      mechanical = scanMechanical(repoPath);
    } catch (err) {
      console.error("Mechanical scan failed:", err);
      abortReadinessScan(db, scanId);
      return;
    }

    // Check abort before agent pass
    if (signal.aborted) {
      abortReadinessScan(db, scanId);
      return;
    }

    // Agent pass (blocklist proposals)
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

    // Insert blocklist entries from agent proposals
    for (const proposal of agentResult.blocklistProposals) {
      insertBlocklistEntry(db, {
        pattern: proposal.pattern,
        reason: proposal.reason,
        source: "agent",
        proposedByScanId: scanId,
      });
    }

    // Agent description takes priority; fall back to mechanical (README/package.json)
    const description = agentResult.description ?? mechanical.description;

    completeReadinessScan(db, scanId, {
      projectName: mechanical.projectName,
      description,
      techStack: mechanical.techStack,
      testCommand: mechanical.testCommand,
      areaSignals: mechanical.areaSignals,
    });
  };
}
