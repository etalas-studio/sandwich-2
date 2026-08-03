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
  description: string | null;
  blocklistProposals: Array<{ pattern: string; reason: string }>;
  outcome: "ok" | "timeout" | "process_error" | "nonzero_exit" | "aborted";
}

const SCAN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runAgentPass(input: AgentPassInput): Promise<AgentPassResult> {
  if (input.signal.aborted) {
    return { description: null, blocklistProposals: [], outcome: "aborted" };
  }

  const prompt = buildScanPrompt(input.mechanicalResult);
  const engineResult = await input.invoker.run({
    prompt,
    cwd: input.repoPath,
    timeoutMs: SCAN_TIMEOUT_MS,
  });

  const parsed = parseAgentResponse(engineResult.finalText);

  return {
    description: parsed.description,
    blocklistProposals: parsed.blocklist,
    outcome: engineResult.outcome as AgentPassResult["outcome"],
  };
}

function buildScanPrompt(mech: MechanicalResult): string {
  const areaLines = mech.areaSignals
    .map(
      (a) =>
        `  ${a.area}: ${a.files} files, test/code ratio ${a.testToCodeRatio.toFixed(1)}, churn ${a.churnScore.toFixed(1)}`,
    )
    .join("\n");

  return [
    "You are analyzing a codebase. Do two things:",
    "",
    "1. Write a concise project description (2-4 sentences) that explains what this project does, its architecture, and key characteristics. Base this on the codebase structure, not just the README.",
    "",
    "2. Identify files, directories, or operations that an AI agent should NEVER touch without human review. Consider: credential files, production configs, database migrations, deployment scripts, auth modules.",
    "",
    `Project name: ${mech.projectName}`,
    `Detected tech stack: ${mech.techStack}`,
    `Test command: ${mech.testCommand ?? "none"}`,
    "",
    "Area signals:",
    areaLines,
    "",
    "Answer ONLY with a JSON object with two fields: `description` (string) and `blocklist` (array of {pattern, reason}).",
    'Example: {"description":"A pipeline orchestrator that...","blocklist":[{"pattern":"src/secrets/**","reason":"Contains API keys"}]}',
    "If nothing is risky, use an empty blocklist array.",
  ].join("\n");
}

interface ParsedResponse {
  description: string | null;
  blocklist: Array<{ pattern: string; reason: string }>;
}

function parseAgentResponse(text: string): ParsedResponse {
  // Try to find a JSON object with description + blocklist
  const objMatch = text.match(/\{[\s\S]*"description"[\s\S]*"blocklist"[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as Record<string, unknown>;
      const desc = typeof parsed.description === "string" ? parsed.description : null;
      const list = Array.isArray(parsed.blocklist) ? parsed.blocklist : [];
      const blocklist = list.filter(
        (entry): entry is { pattern: string; reason: string } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).pattern === "string" &&
          typeof (entry as Record<string, unknown>).reason === "string",
      );
      return { description: desc, blocklist };
    } catch {
      // fall through to old format
    }
  }

  // Fallback: old format — just a blocklist array, no description
  const arrMatch = text.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        const blocklist = parsed.filter(
          (entry): entry is { pattern: string; reason: string } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).pattern === "string" &&
            typeof (entry as Record<string, unknown>).reason === "string",
        );
        return { description: null, blocklist };
      }
    } catch {
      // ignore
    }
  }

  return { description: null, blocklist: [] };
}
