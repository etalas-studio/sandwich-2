import type Database from "better-sqlite3";
import { scanMechanical } from "./mechanical.js";
import { runAgentPass } from "./agent-pass.js";
import {
  completeReadinessScan,
  abortReadinessScan,
} from "../db/readiness-scans.js";
import { insertBlocklistEntry } from "../db/blocklist.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PiRuntime = any;

export function createScanRunner(
  db: Database.Database,
  modelRuntime: PiRuntime | null,
): (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void> {
  return async (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => {
    // Mechanical pass (synchronous, fast)
    let mechanical;
    try {
      mechanical = scanMechanical(repoPath);
    } catch (err) {
      console.error("Mechanical scan failed:", err);
      abortReadinessScan(db, scanId);
      return;
    }

    if (signal.aborted) {
      abortReadinessScan(db, scanId);
      return;
    }

    const invoker = buildInvoker(modelRuntime, modelId);

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

function buildInvoker(
  modelRuntime: PiRuntime | null,
  modelId: string | null,
): {
  run: (opts: { prompt: string; cwd: string; timeoutMs: number }) => Promise<{ outcome: string; finalText: string }>;
} {
  let model: unknown = undefined;
  if (modelRuntime && modelId) {
    const slashIdx = modelId.indexOf("/");
    if (slashIdx > 0) {
      const provider = modelId.slice(0, slashIdx);
      const id = modelId.slice(slashIdx + 1);
      model = (modelRuntime as any).getModel(provider, id);
    }
  }

  if (!modelRuntime || !model) {
    return {
      async run(opts) {
        console.log("Agent pass not yet wired (prompt:", opts.prompt.slice(0, 80) + "...)");
        return {
          outcome: "ok" as const,
          finalText: JSON.stringify({ description: null, blocklist: [] }),
        };
      },
    };
  }

  return {
    async run(opts) {
      try {
        const msg = await (modelRuntime as any).completeSimple(
          model!,
          { messages: [{ role: "user", content: opts.prompt }] },
          { timeoutMs: opts.timeoutMs },
        );
        const text = (msg.text as Array<{ text: string }> | undefined)?.map((t) => t.text).join("\n") ?? "";
        return { outcome: "ok" as const, finalText: text };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("timeout") || message.includes("aborted") || message.includes("abort")) {
          return { outcome: "timeout" as const, finalText: "" };
        }
        console.error("Agent pass engine error:", message);
        return { outcome: "process_error" as const, finalText: "" };
      }
    },
  };
}
