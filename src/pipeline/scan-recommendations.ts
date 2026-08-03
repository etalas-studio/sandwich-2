import type { AreaSignal, ReadinessRecommendation } from "../db/readiness-scans.js";

export interface RecommendationInputs {
  testCommand: string | null;
  areaSignals: AreaSignal[];
  agentContextFile: string | null;
  readme: { exists: boolean; substantial: boolean };
  hasCI: boolean;
}

/**
 * Heuristic thresholds, not calibrated against real outcome data (Judge is
 * still stubbed, so there's no review-outcome loop yet to tune against —
 * see docs/superpowers/specs/2026-08-02-phase-1-product-design.md). Flagged
 * as heuristics in the recommendation text itself rather than presented as
 * a precise score, on purpose.
 */
const LOW_COVERAGE_RATIO_THRESHOLD = 0.3;
const HIGH_CHURN_THRESHOLD = 0.5;
const MAX_AREA_RECOMMENDATIONS = 3;

/**
 * Turns mechanical scan signals into a plain-English, risk-sorted
 * recommendation list — the headline of the Overview readiness card. Per
 * docs/superpowers/specs/2026-08-04-readiness-scan-design.md's follow-up:
 * raw numbers alone don't answer "how AI-ready is this project," and the
 * scan's job is to be a coarse signal a human can act on, not a score.
 */
export function buildRecommendations(inputs: RecommendationInputs): ReadinessRecommendation[] {
  const recommendations: ReadinessRecommendation[] = [];

  if (!inputs.agentContextFile) {
    recommendations.push({
      id: "missing-agent-context",
      severity: "high",
      message:
        "No CLAUDE.md or AGENTS.md found — the agent has no persistent project context and is reading blind on every ticket.",
    });
  }

  if (!inputs.testCommand) {
    recommendations.push({
      id: "missing-test-command",
      severity: "high",
      message:
        'No test command detected — add one to package.json\'s "scripts.test" so Verify can actually run tests instead of stopping at needs-human.',
    });
  }

  if (!inputs.readme.exists || !inputs.readme.substantial) {
    recommendations.push({
      id: "weak-readme",
      severity: "medium",
      message: inputs.readme.exists
        ? "README exists but is very short — there's little onboarding context for a human or an agent."
        : "No README found — there's no onboarding context for a human or an agent.",
    });
  }

  if (!inputs.hasCI) {
    recommendations.push({
      id: "missing-ci",
      severity: "low",
      message: "No CI config detected — nothing catches a regression except this pipeline's own Verify stage.",
    });
  }

  const riskyAreas = inputs.areaSignals
    .filter(
      (area) => area.testToCodeRatio < LOW_COVERAGE_RATIO_THRESHOLD && area.churnScore > HIGH_CHURN_THRESHOLD,
    )
    .sort((a, b) => b.churnScore - a.churnScore)
    .slice(0, MAX_AREA_RECOMMENDATIONS);

  for (const area of riskyAreas) {
    recommendations.push({
      id: `low-coverage-high-churn:${area.pathPrefix}`,
      severity: "medium",
      message: `"${area.pathPrefix}" has low test coverage (ratio ${area.testToCodeRatio.toFixed(2)}) but a lot of recent activity (churn ${area.churnScore.toFixed(2)}) — tickets touching it will likely need human review.`,
    });
  }

  return recommendations;
}
