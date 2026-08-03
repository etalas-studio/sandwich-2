/**
 * Engine-agnostic contract for invoking a coding agent. One implementation
 * exists so far (ClaudeCodeInvoker, see claude-code.ts) — this interface is
 * what lets a second engine (e.g. a Pi SDK implementation, a later plan) be
 * added without touching any code that calls an EngineInvoker.
 */
export interface EngineInvoker {
  /**
   * Run a single prompt against a target working directory and return once
   * the agent's turn is complete. Never throws for engine-level failures
   * (timeout, non-zero exit, etc.) — those are reported via EngineRunResult.outcome.
   * Only throws for programmer errors (e.g. invalid options).
   */
  run(options: EngineRunOptions): Promise<EngineRunResult>;
}

export interface EngineRunOptions {
  /** The task instruction sent to the agent. */
  prompt: string;
  /** Directory the agent operates in — always a git worktree in real use, never the main checkout. */
  cwd: string;
  /** Hard ceiling on how long a single run may take before being killed. */
  timeoutMs: number;
  /**
   * Called once per line of new output as it arrives, for live progress
   * display (the Visibility requirement in the design doc). What a "line"
   * means is engine-specific — for a JSON-lines engine it's one JSON object;
   * for a PTY-based engine it's one line of decoded terminal text.
   */
  onOutputLine?: (line: string) => void;
  /**
   * When aborted, the invoker kills the underlying process and resolves
   * with outcome "aborted" instead of throwing — same never-throws contract
   * as every other engine-level outcome. Lets a human stop an in-flight run
   * from the UI without waiting out its timeout.
   */
  signal?: AbortSignal;
}

export type EngineOutcome = "ok" | "timeout" | "process_error" | "nonzero_exit" | "aborted";

export interface EngineRunResult {
  outcome: EngineOutcome;
  /** The agent's final answer text, extracted from raw output. Empty string if outcome !== "ok". */
  finalText: string;
  /** Every line passed to onOutputLine during the run, in order — the full transcript. */
  transcript: string[];
  durationSec: number;
  /** Process exit code, if the process actually exited (null if killed by timeout). */
  exitCode: number | null;
}
