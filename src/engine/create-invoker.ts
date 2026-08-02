import { ClaudeCodeInvoker } from "./claude-code.js";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";
import type { EngineInvoker } from "./types.js";

/**
 * "headless" (claude -p) is the default across this project — see the
 * Phase 1 design doc's "Agent engine" section. "pty" is an explicit opt-in
 * for cost-durability reasons; nothing selects it automatically.
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
