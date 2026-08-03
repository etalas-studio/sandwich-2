import type { MechanicalResult } from "./mechanical.js";

export interface AgentPassInput {
  repoPath: string;
  mechanicalResult: MechanicalResult;
  signal: AbortSignal;
  invoker: {
    run: (opts: {
      prompt: string;
      cwd: string;
      timeoutMs: number;
    }) => Promise<{ outcome: string; finalText: string }>;
  };
}

export interface AgentPassResult {
  blocklistProposals: Array<{ pattern: string; reason: string }>;
  outcome: "ok" | "timeout" | "process_error" | "nonzero_exit" | "aborted";
}

const SCAN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runAgentPass(input: AgentPassInput): Promise<AgentPassResult> {
  if (input.signal.aborted) {
    return { blocklistProposals: [], outcome: "aborted" };
  }

  const prompt = buildBlocklistPrompt(input.mechanicalResult);
  const engineResult = await input.invoker.run({
    prompt,
    cwd: input.repoPath,
    timeoutMs: SCAN_TIMEOUT_MS,
  });

  const proposals = parseBlocklistJson(engineResult.finalText);

  return {
    blocklistProposals: proposals,
    outcome: engineResult.outcome as AgentPassResult["outcome"],
  };
}

function buildBlocklistPrompt(mech: MechanicalResult): string {
  const areaLines = mech.areaSignals
    .map((a) => `  ${a.area}: ${a.files} files, test/code ratio ${a.testToCodeRatio.toFixed(1)}, churn ${a.churnScore.toFixed(1)}`)
    .join("\n");

  return [
    "You are analyzing a codebase to identify paths and actions that are too risky for autonomous AI agents.",
    "",
    `Project: ${mech.projectName}`,
    `Tech stack: ${mech.techStack}`,
    `Test command: ${mech.testCommand ?? "none"}`,
    "",
    "Area signals:",
    areaLines,
    "",
    "Identify files, directories, or operations that an AI agent should NEVER touch without human review.",
    "Consider: credential files, production configs, database migrations, deployment scripts, auth modules.",
    "",
    "Answer ONLY with a JSON array. Each entry must have `pattern` (glob or path pattern) and `reason` (short explanation).",
    'Example: [{"pattern":"src/secrets/**","reason":"Contains API keys and tokens"}]',
    "If nothing is risky, respond with an empty array: []",
  ].join("\n");
}

function parseBlocklistJson(text: string): Array<{ pattern: string; reason: string }> {
  // Find the first JSON array in the text
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is { pattern: string; reason: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).pattern === "string" &&
        typeof (entry as Record<string, unknown>).reason === "string",
    );
  } catch {
    return [];
  }
}
