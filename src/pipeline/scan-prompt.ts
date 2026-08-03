import type { AreaSignal } from "../db/readiness-scans.js";

export interface ScanSignals {
  techStack: string;
  testCommand: string | null;
  areaSignals: AreaSignal[];
}

export interface BlocklistProposal {
  pattern: string;
  reason: string;
}

export interface ScanAssessment {
  /** 2-3 sentence plain-English description of what the codebase actually is/does. Null if the agent didn't provide one. */
  codebaseSummary: string | null;
  /** 2-3 sentence assessment of whether the repo already has an established, agent-friendly workflow, or lacks one. Null if the agent didn't provide one. */
  agenticFlowSummary: string | null;
  blocklist: BlocklistProposal[];
}

function formatAreaSignals(areaSignals: AreaSignal[]): string {
  if (areaSignals.length === 0) return "  (no areas detected)";
  return areaSignals
    .map(
      (area) =>
        `  - ${area.pathPrefix}: test-to-code ratio ${area.testToCodeRatio.toFixed(2)}, churn score ${area.churnScore.toFixed(2)}`,
    )
    .join("\n");
}

/**
 * Asks the agent for three things in one call — a codebase summary, an
 * assessment of whether an agent-friendly workflow already exists, and a
 * blocklist proposal — answering with nothing but a JSON object, no prose,
 * no markdown fences, so parseScanAssessment has one predictable shape to
 * parse. Kept deliberately short: a mechanical-signal-informed pass, not a
 * deep audit (see docs/superpowers/specs/2026-08-04-readiness-scan-design.md).
 */
export function buildScanAssessmentPrompt(signals: ScanSignals): string {
  return `You are assessing a codebase for how ready it is for an AI coding agent to work in it autonomously.

Tech stack: ${signals.techStack}
Test command: ${signals.testCommand ?? "none recorded"}
Per-area signals (test-to-code ratio, churn score):
${formatAreaSignals(signals.areaSignals)}

Look at the repository (you have shell access) and answer three things:

1. In 2-3 sentences, what does this codebase actually do — its purpose and main components?
2. In 2-3 sentences, does this repo already have a clear, established workflow for how changes should be made — documented conventions, a consistent testing discipline, lint/type-check gates, CI, or an existing agent context file (CLAUDE.md/AGENTS.md)? Or is there little to no established process? Be specific about what you found or didn't find.
3. Identify any paths or actions too risky for an autonomous agent to touch without human review (e.g. database migrations, authentication logic, payment/billing code, files that look like they hold secrets).

Respond with nothing but a single JSON object, no prose and no markdown code fences, in this exact shape:
{"codebaseSummary": "...", "agenticFlowSummary": "...", "blocklist": [{"pattern": "path/or/glob", "reason": "why this is risky"}]}

If nothing stands out as risky, use an empty array for "blocklist".`;
}

/**
 * Extracts the first JSON object substring from the agent's final answer
 * and parses it. Tolerates prose/markdown fences around the object. Returns
 * `null` (never throws) when no JSON object could be found/parsed at all —
 * distinct from a successfully-parsed response with an empty blocklist,
 * which is the expected, unremarkable case when the agent found nothing
 * risky (the prompt explicitly asks for `[]` in that case). Callers should
 * only warn on `null`, not on an empty blocklist.
 */
export function parseScanAssessment(text: string): ScanAssessment | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  const codebaseSummary = asNonEmptyString(obj["codebaseSummary"]);
  const agenticFlowSummary = asNonEmptyString(obj["agenticFlowSummary"]);

  const rawBlocklist = Array.isArray(obj["blocklist"]) ? obj["blocklist"] : [];
  const blocklist: BlocklistProposal[] = [];
  for (const item of rawBlocklist) {
    if (typeof item !== "object" || item === null) continue;
    const pattern = (item as Record<string, unknown>)["pattern"];
    const reason = (item as Record<string, unknown>)["reason"];
    if (typeof pattern === "string" && pattern.trim().length > 0 && typeof reason === "string") {
      blocklist.push({ pattern: pattern.trim(), reason: reason.trim() });
    }
  }

  return { codebaseSummary, agenticFlowSummary, blocklist };
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
