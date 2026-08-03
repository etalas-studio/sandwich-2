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
 * Asks the agent to propose paths/actions too risky for autonomous work,
 * answering with nothing but a JSON array — no prose, no markdown fences —
 * so parseBlocklistProposal has one predictable shape to parse. Kept
 * deliberately short: a mechanical signal-gathering pass, not a deep audit
 * (see docs/superpowers/specs/2026-08-04-readiness-scan-design.md).
 */
export function buildBlocklistProposalPrompt(signals: ScanSignals): string {
  return `You are scanning a codebase to identify paths and actions too risky for an autonomous coding agent to touch without human review.

Tech stack: ${signals.techStack}
Test command: ${signals.testCommand ?? "none recorded"}
Per-area signals (test-to-code ratio, churn score):
${formatAreaSignals(signals.areaSignals)}

Look at the repository (you have shell access) and identify paths or actions that should be blocked from autonomous agent work — for example database migrations, authentication logic, payment/billing code, or files that look like they hold secrets.

Respond with nothing but a JSON array, no prose and no markdown code fences, in this exact shape:
[{"pattern": "path/or/glob", "reason": "why this is risky"}]

If nothing stands out as risky, respond with an empty array: []`;
}

/**
 * Extracts the first JSON array substring from the agent's final answer and
 * parses it. Tolerates prose/markdown fences around the array. Returns an
 * empty array (never throws) for anything that doesn't parse into a
 * well-formed list of {pattern, reason} objects, so a scan is never failed
 * over this step alone.
 */
export function parseBlocklistProposal(text: string): BlocklistProposal[] {
  const match = /\[[\s\S]*\]/.exec(text);
  if (!match) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: BlocklistProposal[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const pattern = (item as Record<string, unknown>)["pattern"];
    const reason = (item as Record<string, unknown>)["reason"];
    if (typeof pattern === "string" && pattern.trim().length > 0 && typeof reason === "string") {
      entries.push({ pattern: pattern.trim(), reason: reason.trim() });
    }
  }
  return entries;
}
