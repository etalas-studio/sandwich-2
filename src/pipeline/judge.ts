import type { PipelineContext, JudgeResult } from "./types.js";

/**
 * Stubbed to always return agent-ready. The Phase 1 spec's real Judge
 * (agent call, blocklist cross-check, categorized needs-human) is deferred
 * until the readiness-scan piece exists to give it something real to judge
 * against — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md
 * "Judge is stubbed". This function still exists and is still called by
 * the orchestrator so that swapping in real logic later only touches this
 * one file.
 */
export async function judge(_ctx: PipelineContext): Promise<JudgeResult> {
  return { outcome: "agent_ready" };
}
