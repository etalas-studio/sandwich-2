import { runProcess } from "./proc.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "./types.js";

export interface ClaudeCodeInvokerOptions {
  /** Defaults to "claude" — overridable so tests can point at a fake binary. */
  bin?: string;
}

/**
 * Headless Claude Code invocation, via `claude -p`. See the Phase 1 design
 * doc's "Agent engine" section for why headless was chosen over an
 * interactive PTY session (or the reverse — check poc/README.md for
 * which mode this project actually settled on).
 */
export class ClaudeCodeInvoker implements EngineInvoker {
  private readonly bin: string;

  constructor(options: ClaudeCodeInvokerOptions = {}) {
    this.bin = options.bin ?? "claude";
  }

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    const { prompt, cwd, timeoutMs, onOutputLine, signal } = options;
    const transcript: string[] = [];

    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];

    const result = await runProcess(this.bin, args, {
      cwd,
      timeoutMs,
      signal,
      onStdoutLine: (line) => {
        transcript.push(line);
        onOutputLine?.(line);
      },
    });

    if (result.aborted) {
      return {
        outcome: "aborted",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: result.exitCode,
      };
    }

    if (result.timedOut) {
      return {
        outcome: "timeout",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: result.exitCode,
      };
    }

    if (result.exitCode === null) {
      return {
        outcome: "process_error",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: null,
      };
    }

    if (result.exitCode !== 0) {
      return {
        outcome: "nonzero_exit",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: result.exitCode,
      };
    }

    return {
      outcome: "ok",
      finalText: extractFinalText(transcript),
      transcript,
      durationSec: result.durationSec,
      exitCode: result.exitCode,
    };
  }
}

/**
 * Pull the agent's final answer out of a stream-json transcript. Tolerant by
 * design: if a line isn't valid JSON (e.g. the engine's output format ever
 * changes), it's skipped rather than thrown — losing one line of parsing is
 * better than losing the entire run's result.
 */
function extractFinalText(transcript: string[]): string {
  for (const line of transcript) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (typeof parsed !== "object" || parsed === null) continue;
    const obj = parsed as Record<string, unknown>;
    if (obj["type"] === "result" && typeof obj["result"] === "string") {
      return obj["result"];
    }
  }
  return "";
}
