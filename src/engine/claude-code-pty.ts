import * as pty from "node-pty";
import type { EngineInvoker, EngineRunOptions, EngineRunResult, EngineOutcome } from "./types.js";

export interface ClaudeCodePtyInvokerOptions {
  /** Defaults to "claude" — overridable so tests can point at a fake binary. */
  bin?: string;
  /**
   * How long to wait after the last observed output before sending "/exit"
   * to force a clean session close. Interactive Claude Code sessions never
   * exit on their own — this is required, not optional. Defaults to 20000ms,
   * matching the value validated in the original PoC (poc/claude-pty-poc.mjs).
   *
   * This is PTY-specific behavior with no headless equivalent, so it stays a
   * constructor option rather than part of EngineRunOptions — the shared
   * interface only carries what every engine implementation needs.
   */
  exitAfterMs?: number;
}

const TRUST_DIALOG_PATTERN = /Is.{0,80}this.{0,80}a.{0,80}project.{0,80}you.{0,80}trust\?/i;
const PERMISSION_DIALOG_PATTERN = /do.{0,20}you.{0,20}want.{0,20}to.{0,20}(proceed|allow)/i;

/**
 * Interactive PTY-based Claude Code invocation. Exists as an opt-in
 * alternative to headless (ClaudeCodeInvoker) for cost-durability reasons —
 * see the Phase 1 design doc's "Agent engine" section and poc/README.md for
 * the full reasoning. Both classes implement EngineInvoker identically from
 * a caller's perspective.
 */
export class ClaudeCodePtyInvoker implements EngineInvoker {
  private readonly bin: string;
  private readonly exitAfterMs: number;

  constructor(options: ClaudeCodePtyInvokerOptions = {}) {
    this.bin = options.bin ?? "claude";
    this.exitAfterMs = options.exitAfterMs ?? 20000;
  }

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    const { prompt, cwd, timeoutMs, onOutputLine } = options;
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const term = pty.spawn(this.bin, [prompt], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd,
        env: process.env as Record<string, string>,
      });

      let rawBuffer = "";
      const transcript: string[] = [];
      let sawTrustDialog = false;
      let sawPermissionDialog = false;
      let finished = false;
      let exitTimer: NodeJS.Timeout | null = null;
      let safetyTimer: NodeJS.Timeout | null = null;

      const clearTimers = () => {
        if (exitTimer) clearTimeout(exitTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
      };

      const finish = (outcome: EngineOutcome, exitCode: number | null) => {
        if (finished) return;
        finished = true;
        clearTimers();
        resolve({
          outcome,
          finalText: outcome === "ok" ? extractFinalText(rawBuffer) : "",
          transcript,
          durationSec: (Date.now() - startedAt) / 1000,
          exitCode,
        });
      };

      term.onData((chunk: string) => {
        rawBuffer += chunk;
        transcript.push(chunk);
        onOutputLine?.(chunk);

        if (!sawTrustDialog && TRUST_DIALOG_PATTERN.test(rawBuffer)) {
          sawTrustDialog = true;
          setTimeout(() => term.write("\r"), 500);
        }
        if (!sawPermissionDialog && PERMISSION_DIALOG_PATTERN.test(rawBuffer)) {
          sawPermissionDialog = true;
          setTimeout(() => term.write("\r"), 500);
        }
      });

      term.onExit(({ exitCode }) => {
        finish(exitCode === 0 ? "ok" : "nonzero_exit", exitCode);
      });

      exitTimer = setTimeout(() => {
        if (!finished) term.write("/exit\r");
      }, this.exitAfterMs);

      safetyTimer = setTimeout(() => {
        if (!finished) {
          term.kill();
          finish("timeout", null);
        }
      }, timeoutMs);
    });
  }
}

/**
 * Pull the agent's answer out of a raw PTY buffer. Unlike headless mode's
 * clean JSON, this buffer is mixed with ANSI escape codes and TUI chrome —
 * this is a best-effort extraction, not a robust parser. This limitation is
 * recorded in poc/README.md as the known tradeoff of the PTY approach.
 */
function extractFinalText(rawBuffer: string): string {
  // Strip common ANSI escape sequences (cursor movement, color codes) so a
  // plain-text match has a chance of finding the real answer underneath.
  // eslint-disable-next-line no-control-regex
  const stripped = rawBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  return stripped.trim();
}
