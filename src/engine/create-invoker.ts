import { ClaudeCodeInvoker } from "./claude-code.js";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";
import type { EngineInvoker } from "./types.js";

/**
 * "headless" (claude -p) was the Phase 1 design doc's initially recommended
 * default — see its "Agent engine" section. This instance's actual config
 * (src/pipeline/config.ts) defaults to "pty" instead; see
 * docs/superpowers/specs/2026-08-03-pipeline-shape-design.md. Either way,
 * this factory never auto-selects — the caller always passes an explicit
 * mode.
 */
export type EngineInvocationMode = "headless" | "pty";

/**
 * The single place that knows both concrete EngineInvoker implementations
 * exist. Every caller depends only on the returned EngineInvoker, never on
 * ClaudeCodeInvoker or ClaudeCodePtyInvoker directly.
 */
export function createEngineInvoker(mode: EngineInvocationMode): EngineInvoker {
  if (mode === "pty") {
    return new ClaudeCodePtyInvoker();
  }
  return new ClaudeCodeInvoker();
}
