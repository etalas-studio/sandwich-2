import { summarizeDiff, commitAll } from "../git.js";
import { listBlocklistEntries } from "../db/blocklist.js";
import { insertRunArtifact } from "../db/run-artifacts.js";
import type { PipelineContext, ImplementResult } from "./types.js";
import type { Ticket } from "../db/tickets.js";

function buildImplementPrompt(ticket: Ticket): string {
  return [
    `Ticket ${ticket.key}: ${ticket.summary}`,
    "",
    ticket.description,
    "",
    "Implement this ticket directly in the current working directory. Make whatever code changes are needed to satisfy it. Do not produce a plan or ask for approval — make the change directly.",
  ].join("\n");
}

interface BlocklistHit {
  file: string;
  pattern: string;
  reason: string;
}

/**
 * Compiles a wildcard blocklist pattern into a fully anchored regex.
 *
 * `*` is a single-path-segment wildcard (`[^/]*`), except a *trailing* `*`,
 * which reads as "everything under here" and so crosses `/` (`.*`) — that's
 * what a human writing `src/secrets/*` means. Anchoring both ends matters:
 * without a trailing `$`, `config/*.key` would also swallow
 * `config/prod.key.bak`.
 */
function compileBlocklistPattern(pattern: string): RegExp {
  const hasTrailingWildcard = pattern.endsWith("*");
  const body = hasTrailingWildcard ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}${hasTrailingWildcard ? ".*" : ""}$`);
}

/**
 * Pattern is a path prefix, with `*` supported as a wildcard (see
 * compileBlocklistPattern). Deliberately simple — the blocklist has to be
 * human-readable and auditable, not its own pattern language.
 *
 * A wildcard pattern is tested against both the full repo-relative path and
 * the file's basename, so `*.env`/`*.pem`/`*.key` — which a human writes to
 * mean "secrets anywhere in the repo" — also protect nested files like
 * `config/secrets.env`, not just files at the repo root. Erring toward
 * over-blocking is deliberate: while Judge is stubbed, this check is the
 * only blocklist enforcement there is.
 */
function matchesBlocklistPattern(file: string, pattern: string): boolean {
  const normalized = file.replace(/^\.\//, "");
  if (pattern.includes("*")) {
    const regex = compileBlocklistPattern(pattern);
    const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
    return regex.test(normalized) || regex.test(basename);
  }
  return normalized === pattern || normalized.startsWith(pattern);
}

function findBlocklistHit(
  files: string[],
  entries: { pattern: string; reason: string }[],
): BlocklistHit | null {
  for (const file of files) {
    for (const entry of entries) {
      if (matchesBlocklistPattern(file, entry.pattern)) {
        return { file, pattern: entry.pattern, reason: entry.reason };
      }
    }
  }
  return null;
}

/**
 * Real agent invocation with cwd-confined shell access (no additional
 * sandboxing beyond the worktree directory). Blocklist enforcement here is
 * the only safety net while Judge is stubbed — see judge.ts and the design
 * doc's "Outcome model" section.
 */
export async function implement(ctx: PipelineContext): Promise<ImplementResult> {
  const engineResult = await ctx.engine.run({
    prompt: buildImplementPrompt(ctx.ticket),
    cwd: ctx.worktreePath,
    timeoutMs: ctx.implementTimeoutMs,
  });

  insertRunArtifact(ctx.db, {
    runId: ctx.runId,
    kind: "implement_transcript",
    content: engineResult.transcript.join("\n"),
  });

  if (engineResult.outcome === "timeout") {
    return {
      outcome: "implement_timeout",
      needsHumanCategory: null,
      needsHumanReason: `implement exceeded its ${String(ctx.implementTimeoutMs / 1000)}s timeout`,
    };
  }
  if (engineResult.outcome === "process_error") {
    return {
      outcome: "implement_error",
      needsHumanCategory: null,
      needsHumanReason: "the implement engine process failed to run",
    };
  }
  if (engineResult.outcome === "nonzero_exit") {
    return {
      outcome: "implement_nonzero_exit",
      needsHumanCategory: null,
      needsHumanReason: `the implement engine exited with code ${String(engineResult.exitCode)}`,
    };
  }

  const diff = await summarizeDiff(ctx.worktreePath, ctx.baseCommit);
  insertRunArtifact(ctx.db, { runId: ctx.runId, kind: "diff_patch", content: diff.patch });

  if (diff.filesChanged === 0) {
    return {
      outcome: "no_changes",
      needsHumanCategory: null,
      needsHumanReason: "the agent made no changes to the worktree",
    };
  }

  const blocklist = listBlocklistEntries(ctx.db);
  const hit = findBlocklistHit(
    diff.stats.map((s) => s.file),
    blocklist,
  );
  if (hit) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "forbidden_path_or_action",
      needsHumanReason: `changed file "${hit.file}" matches blocklist pattern "${hit.pattern}" (${hit.reason})`,
    };
  }

  await commitAll(
    ctx.worktreePath,
    `[${ctx.ticket.key}] ${ctx.ticket.summary}\n\nImplemented by agent (${ctx.engineName}). Needs human review.`,
  );

  return { outcome: "changes_committed", needsHumanCategory: null, needsHumanReason: null };
}
