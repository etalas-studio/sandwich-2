import { exec } from "../proc.js";
import { getLatestReadinessScan } from "../db/readiness-scans.js";
import { insertRunArtifact } from "../db/run-artifacts.js";
import type { PipelineContext, VerifyResult } from "./types.js";

/**
 * Splits a recorded test command into a bin + args token array, honoring
 * single- and double-quoted segments so a quoted phrase (e.g. `--grep
 * "user auth"`) survives as one argument. This is the only thing that gets
 * to interpret quoting: `exec()` in src/proc.ts deliberately never uses a
 * shell (spawns with `shell: false`) to avoid injection, so naive
 * whitespace splitting here would silently break any quoted argument.
 * Dependency-free by design — this repo has no shell-parsing library and
 * doesn't need one for this.
 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of command) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Runs the readiness scan's recorded test command as a plain child process
 * — never through EngineInvoker, since this is a shell command, not an
 * agent call. Exit code only, per the Phase 1 spec's "Verify: exit-code
 * only" architecture decision. The missing-test-command check below is
 * normally Judge's job (see judge.ts) but lives here while Judge is
 * stubbed — see the design doc's "Outcome model" section.
 */
export async function verify(ctx: PipelineContext): Promise<VerifyResult> {
  if (ctx.signal.aborted) {
    return { outcome: "verify_aborted", needsHumanCategory: null, needsHumanReason: "stopped by human" };
  }

  const scan = getLatestReadinessScan(ctx.db);
  const testCommand = scan?.testCommand?.trim() ?? "";

  if (testCommand.length === 0) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "weak_verification",
      needsHumanReason: "no readiness scan has recorded a test command yet",
    };
  }

  const parts = tokenizeCommand(testCommand);
  const bin = parts[0];
  if (bin === undefined) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "weak_verification",
      needsHumanReason: "recorded test command is empty",
    };
  }
  const args = parts.slice(1);

  const result = await exec(bin, args, {
    cwd: ctx.worktreePath,
    timeoutMs: ctx.verifyTimeoutMs,
    signal: ctx.signal,
  });

  insertRunArtifact(ctx.db, {
    runId: ctx.runId,
    kind: "verify_output",
    content: `${result.stdout}\n--- stderr ---\n${result.stderr}`,
  });

  if (result.aborted) {
    return { outcome: "verify_aborted", needsHumanCategory: null, needsHumanReason: "stopped by human" };
  }

  if (result.timedOut) {
    return {
      outcome: "verify_timeout",
      needsHumanCategory: null,
      needsHumanReason: `test command exceeded its ${String(ctx.verifyTimeoutMs / 1000)}s timeout`,
    };
  }

  if (result.exitCode === 0) {
    return { outcome: "ready_for_pr", needsHumanCategory: null, needsHumanReason: null };
  }

  return {
    outcome: "verify_failed",
    needsHumanCategory: null,
    needsHumanReason: `test command exited with code ${String(result.exitCode)}`,
  };
}
