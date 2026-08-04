import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { getTicket, updateTicket } from "../db/tickets.js";
import type { Ticket } from "../db/tickets.js";
import { getBlocklistEntries } from "../db/blocklist.js";
import { getCurrentProject } from "../db/project.js";
import { getValidOAuthToken } from "./oauth-integrations.js";
import { buildCloneUrl } from "./project-clone.js";
import { createGithubVcsClient } from "./vcs-github.js";
import { createBitbucketVcsClient } from "./vcs-bitbucket.js";
import type { InvokerFactory } from "../scanner/run-scan.js";

export type StageName = "judge" | "implement" | "verify" | "open_pr";

export interface TicketRunEvent {
  type: "stage_start" | "stage_end" | "output" | "error" | "done";
  stage?: StageName;
  text?: string;
  ticket?: Ticket;
}

const TICKET_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

export async function runTicketPipeline(
  db: Database.Database,
  createInvoker: InvokerFactory,
  ticketKey: string,
  repoPath: string,
  modelId: string | null,
  onEvent: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const emit = (event: TicketRunEvent) => {
    if (!signal.aborted) onEvent(event);
  };

  // Resolve once here so every stage's `git -C <repoPath>` calls see an
  // unambiguous absolute path (a relative repoPath resolves against -C's
  // dir, not the process cwd, which breaks worktree path construction).
  repoPath = resolve(repoPath);

  // Fetch ticket
  const ticket = getTicket(db, ticketKey);
  if (!ticket) {
    emit({ type: "error", text: "Ticket not found" });
    return;
  }

  // Determine starting stage — resume from current if mid-pipeline
  const currentStage = ticket.stage as StageName | null;
  let startStage: StageName = "judge";

  if (ticket.status === "in_progress" && currentStage) {
    // Resume from current stage
    startStage = currentStage;
  } else if (ticket.status === "done" || ticket.status === "blocked") {
    // Already finished — nothing to do
    emit({ type: "done", ticket: getTicket(db, ticketKey)! });
    return;
  }

  // Mark as in-progress
  updateTicket(db, ticketKey, {
    status: "in_progress",
    startedAt: new Date().toISOString(),
  });

  const stages: StageName[] = ["judge", "implement", "verify", "open_pr"];
  const startIdx = stages.indexOf(startStage);

  for (let i = startIdx; i < stages.length; i++) {
    if (signal.aborted) return;

    const stage = stages[i]!;
    // Update ticket stage
    updateTicket(db, ticketKey, { stage });
    emit({ type: "stage_start", stage, ticket: getTicket(db, ticketKey)! });

    let result: StageResult;
    try {
      switch (stage) {
        case "judge":
          result = await runJudge(db, createInvoker, ticket, repoPath, modelId, emit, signal);
          break;
        case "implement":
          result = await runImplement(db, createInvoker, ticket, repoPath, modelId, emit, signal);
          break;
        case "verify":
          result = await runVerify(db, createInvoker, ticket, repoPath, modelId, emit, signal);
          break;
        case "open_pr":
          result = await runOpenPr(db, ticket, repoPath, emit, signal);
          break;
        default:
          result = { ok: false, reason: "unknown stage" };
      }
    } catch (err) {
      result = { ok: false, reason: err instanceof Error ? err.message : "stage failed" };
    }

    if (signal.aborted) return;

    if (!result.ok) {
      // Stage failed — block the ticket
      const updateInput: Record<string, unknown> = {
        status: "blocked",
        needsHumanReason: result.reason ?? "stage failed",
        needsHumanCategory: result.category ?? "agent_error",
        finishedAt: new Date().toISOString(),
      };
      if (result.choices && result.choices.length > 0) {
        updateInput.quickWinChoices = JSON.stringify(result.choices);
        updateInput.needsHumanCategory = "second_chance";
      }
      updateTicket(db, ticketKey, updateInput);
      emit({ type: "stage_end", stage, ticket: getTicket(db, ticketKey)! });
      emit({ type: "done", ticket: getTicket(db, ticketKey)! });
      return;
    }

    emit({ type: "stage_end", stage, ticket: getTicket(db, ticketKey)! });
  }

  // All stages complete
  emit({ type: "done", ticket: getTicket(db, ticketKey)! });
}

interface StageResult {
  ok: boolean;
  reason?: string;
  category?: string;
  choices?: Array<{ label: string; description: string; inject: string }>;
}

/** Strips an OAuth token from a string before it's stored/displayed — git error
 * messages echo the failing command, which embeds the token when pushing via URL. */
function redactToken(text: string, token: string): string {
  return token ? text.split(token).join("***") : text;
}

// ── Stage: Judge ──

async function runJudge(
  db: Database.Database,
  createInvoker: InvokerFactory,
  ticket: Ticket,
  repoPath: string,
  modelId: string | null,
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  // 1. Blocklist check
  const blocklist = getBlocklistEntries(db);
  const desc = ticket.description.toLowerCase();
  const url = (ticket.url ?? "").toLowerCase();

  for (const entry of blocklist) {
    const pattern = entry.pattern.toLowerCase();
    if (desc.includes(pattern) || url.includes(pattern)) {
      return {
        ok: false,
        reason: `Blocked by rule: ${entry.reason}`,
        category: "forbidden_path",
      };
    }
  }

  // 2. AI relevance check
  if (!modelId) {
    return { ok: true };
  }

  // Cap second-chance rounds at 1
  const attempts = ticket.quickWinAttempts ?? 0;
  const allowChoices = attempts < 1;

  const invoker = createInvoker(modelId);
  const prompt = [
    "You are judging whether a ticket is agent-ready. Read the ticket and decide if it has enough context for an AI agent to implement it autonomously.",
    "",
    "Rules:",
    "- Small, clear changes (typo fixes, simple refactors, config changes) should pass.",
    "- Before flagging as ambiguous, check the codebase for existing conventions that answer the question (.prettierrc, .eslintrc, tsconfig.json, package.json scripts, etc.).",
    "- If the project already has config files or code patterns that make the answer obvious, use those as defaults and pass the ticket.",
    "- If there IS a small missing decision (e.g. 'which formatter' when Prettier is already configured) and the answer comes down to 2-3 clear options informed by the codebase, return choices. This is a 'second chance'.",
    "- Only block as truly ambiguous if the gap would fundamentally change the implementation approach or the codebase provides no hints.",
    "",
    "Answer ONLY with a JSON object:",
    '{"agentReady": true/false, "reason": "one short sentence explaining why"}',
    "",
    `For second chances (small missing decision with clear options), add a "choices" array: ${allowChoices ? '{"agentReady": false, "reason": "...", "choices": [{"label": "Use Prettier", "description": "Project already has .prettierrc", "inject": "Format code with Prettier (npx prettier --write)"}]}' : 'choices are NOT allowed on this ticket — just use ambiguous_ticket'}`,
    "Each choice needs: label (short), description (why this option), inject (the text to add to the ticket description when chosen). Max 3 choices.",
    "",
    ticket.summary ? `Ticket title: ${ticket.summary}` : "",
    `Ticket key: ${ticket.key}`,
    `Ticket description: ${ticket.description}`,
    ticket.url ? `Ticket URL: ${ticket.url}` : "",
  ].filter(Boolean).join("\n");

  try {
    const result = await invoker.run({
      prompt,
      cwd: repoPath,
      timeoutMs: 60_000,
    });

    if (result.outcome !== "ok") {
      return {
        ok: false,
        reason: `Judge step failed: ${result.outcome}`,
        category: "agent_error",
      };
    }

    const jsonMatch = result.finalText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        agentReady?: boolean;
        reason?: string;
        choices?: Array<{ label: string; description: string; inject: string }>;
      };
      if (parsed.agentReady === false) {
        const choices = parsed.choices?.slice(0, 3).filter(
          (c): c is { label: string; description: string; inject: string } =>
            typeof c.label === "string" && typeof c.inject === "string",
        );
        if (choices && choices.length > 0 && allowChoices) {
          return {
            ok: false,
            reason: parsed.reason ?? "Quick decision needed",
            category: "second_chance",
            choices,
          };
        }
        return {
          ok: false,
          reason: parsed.reason ?? "Not agent-ready",
          category: "ambiguous_ticket",
        };
      }
    }

    // Agent-ready (or couldn't parse — default to pass)
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "judge failed",
      category: "agent_error",
    };
  }
}

// ── Stage: Implement ──

async function runImplement(
  db: Database.Database,
  createInvoker: InvokerFactory,
  ticket: Ticket,
  repoPath: string,
  modelId: string | null,
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  if (!modelId) {
    return { ok: false, reason: "No model selected", category: "credential_missing" };
  }

  const project = getCurrentProject(db);
  const defaultBranch = project?.defaultBranch ?? "main";

  // Create worktree on a named branch (needed for push/PR)
  const branchName = `ticket-${ticket.key}-${randomUUID().slice(0, 6)}`.toLowerCase();
  const worktreesDir = join(repoPath, ".worktrees");
  const worktreePath = join(worktreesDir, branchName);

  try {
    execSync(`mkdir -p "${worktreesDir}"`, { encoding: "utf-8" });
    // Refresh the default branch so new tickets branch off latest remote, not a stale local HEAD
    execSync(`git -C "${repoPath}" fetch origin "${defaultBranch}"`, { encoding: "utf-8", timeout: 30_000 });
    // Create branch + worktree in one step, off the fresh remote ref — never touches
    // the main repo's checkout, so it's safe to run for multiple tickets concurrently.
    execSync(
      `git -C "${repoPath}" worktree add -b "${branchName}" "${worktreePath}" "origin/${defaultBranch}"`,
      { encoding: "utf-8", timeout: 30_000 },
    );

    // Configure git identity in the worktree so the agent can commit
    execSync(`git -C "${worktreePath}" config user.name "Runchise Agent"`, { encoding: "utf-8" });
    execSync(`git -C "${worktreePath}" config user.email "agent@runchise.local"`, { encoding: "utf-8" });

    updateTicket(db, ticket.key, { worktreePath, branchName });
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to create worktree: ${err instanceof Error ? err.message : "unknown"}`,
      category: "agent_error",
    };
  }

  const invoker = createInvoker(modelId);
  const prompt = [
    "You are implementing a code change. Follow TDD: write tests first, then implementation.",
    "",
    "Rules:",
    "- Read CLAUDE.md and any AGENTS.md first for project conventions.",
    "- Write tests before implementation code.",
    "- Keep changes minimal — only what the ticket asks for.",
    "- Run the test command to verify your work.",
    "- Do NOT modify files outside the scope of this ticket.",
    "",
    ticket.summary ? `Title: ${ticket.summary}` : "",
    `Ticket: ${ticket.key}`,
    `Description: ${ticket.description}`,
    ticket.url ? `Source: ${ticket.url}` : "",
    "",
    "When done, your final message should summarize what you changed.",
  ].filter(Boolean).join("\n");

  try {
    const result = await invoker.run({
      prompt,
      cwd: worktreePath,
      timeoutMs: TICKET_TIMEOUT_MS,
    });

    if (result.outcome !== "ok") {
      return {
        ok: false,
        reason: `Implementation failed: ${result.outcome}`,
        category: "agent_error",
      };
    }

    // Commit any uncommitted changes the agent left behind
    try {
      const status = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: "utf-8" });
      if (status.trim()) {
        execSync(`git -C "${worktreePath}" add -A`, { encoding: "utf-8", timeout: 10_000 });
        execSync(`git -C "${worktreePath}" commit -m "${ticket.key}: ${ticket.summary ?? ticket.description.slice(0, 60)}"`, {
          encoding: "utf-8",
          timeout: 10_000,
        });
      }
    } catch {
      // Commit failed — fall through to the mechanical check below
    }

    // Mechanical guard: the agent must produce actual changes (committed or
    // uncommitted). An empty worktree means the agent hallucinated success.
    const hasUncommitted = execSync(
      `git -C "${worktreePath}" status --porcelain`,
      { encoding: "utf-8" },
    ).trim();
    const commitCount = execSync(
      `git -C "${worktreePath}" rev-list --count "origin/${defaultBranch}"..HEAD`,
      { encoding: "utf-8" },
    ).trim();
    if (!hasUncommitted && commitCount === "0") {
      return {
        ok: false,
        reason: "Implementation produced no changes",
        category: "empty_implementation",
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "implementation failed",
      category: "agent_error",
    };
  }
}

// ── Stage: Verify ──

async function runVerify(
  db: Database.Database,
  createInvoker: InvokerFactory,
  ticket: Ticket,
  repoPath: string,
  modelId: string | null,
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  // Refetch — worktreePath was set during implement stage
  const fresh = getTicket(db, ticket.key);
  if (!modelId || !fresh?.worktreePath) {
    return { ok: false, reason: "No model or worktree", category: "agent_error" };
  }

  const project = getCurrentProject(db);
  const defaultBranch = project?.defaultBranch ?? "main";

  // Mechanical guard 1: worktree must have commits (uncommitted changes
  // from a failed auto-commit are still real work — commit them now).
  try {
    const status = execSync(`git -C "${fresh.worktreePath}" status --porcelain`, { encoding: "utf-8" });
    if (status.trim()) {
      execSync(`git -C "${fresh.worktreePath}" add -A`, { encoding: "utf-8", timeout: 10_000 });
      execSync(`git -C "${fresh.worktreePath}" commit -m "${ticket.key}: auto-commit uncommitted changes"`, {
        encoding: "utf-8",
        timeout: 10_000,
      });
    }
  } catch {
    // If commit fails, check commit count below anyway
  }

  const commitCount = execSync(
    `git -C "${fresh.worktreePath}" rev-list --count "origin/${defaultBranch}"..HEAD`,
    { encoding: "utf-8" },
  ).trim();
  if (commitCount === "0") {
    return {
      ok: false,
      reason: "Verification failed: worktree has no commits — implementation produced no changes",
      category: "empty_implementation",
    };
  }

  const invoker = createInvoker(modelId);
  const prompt = [
    "Review your own implementation against the ticket requirements.",
    "",
    ticket.summary ? `Ticket title: ${ticket.summary}` : "",
    `Ticket key: ${ticket.key}`,
    `Ticket description: ${ticket.description}`,
    ticket.url ? `Ticket URL: ${ticket.url}` : "",
    "",
    "Check:",
    "- Do tests pass?",
    "- Does the change match the ticket requirements?",
    "- Any unexpected side effects?",
    "",
    "Answer ONLY with a JSON object:",
    '{"ok": true/false, "summary": "one sentence summary of what was verified", "warnings": ["optional", "warning", "strings"]}',
    "",
    "If tests pass and the change is correct, mark ok: true.",
    "If there are issues, mark ok: false and explain.",
    "Use warnings for things the human should know about (e.g., 'touched an unrelated file'), even when ok: true.",
  ].filter(Boolean).join("\n");

  try {
    const result = await invoker.run({
      prompt,
      cwd: fresh.worktreePath,
      timeoutMs: 120_000,
    });

    const jsonMatch = result.finalText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ok: false,
        reason: "Verify agent returned no valid JSON response",
        category: "weak_verification",
      };
    }
    const parsed = JSON.parse(jsonMatch[0]) as { ok?: boolean; summary?: string; warnings?: string[] };
    if (parsed.ok === false) {
      return {
        ok: false,
        reason: parsed.summary ?? "Verification failed",
        category: "weak_verification",
      };
    }
    // Store warnings if any
    if (parsed.warnings?.length) {
      const existingReason = ticket.needsHumanReason ?? "";
      const warningText = `[WARNINGS] ${parsed.warnings.join("; ")}`;
      updateTicket(db, ticket.key, {
        needsHumanReason: existingReason ? `${existingReason}\n${warningText}` : warningText,
      });
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "verification failed",
      category: "agent_error",
    };
  }
}

// ── Stage: Open PR ──

async function runOpenPr(
  db: Database.Database,
  ticket: Ticket,
  repoPath: string,
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  const fresh = getTicket(db, ticket.key);
  const worktreePath = fresh?.worktreePath;
  const branchName = fresh?.branchName;

  const project = getCurrentProject(db);
  if (!project || project.cloneStatus !== "ready") {
    return { ok: false, reason: "No project configured", category: "agent_error" };
  }

  const token = await getValidOAuthToken(project.provider);
  if (!token) {
    return { ok: false, reason: `${project.provider} is not connected or its token expired — reconnect it`, category: "credential_missing" };
  }

  if (!branchName) {
    return { ok: false, reason: "No branch name — implement stage may have failed", category: "agent_error" };
  }

  // Push using a fresh authenticated URL rather than the `origin` remote, whose
  // embedded token was baked in at clone time and may since have expired/rotated.
  const pushUrl = buildCloneUrl(project.provider, project.owner, project.repoSlug, token);
  try {
    execSync(`git -C "${repoPath}" push "${pushUrl}" "${branchName}"`, {
      encoding: "utf-8",
      timeout: 30_000,
    });
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to push branch: ${redactToken(err instanceof Error ? err.message : "unknown", token)}`,
      category: "agent_error",
    };
  }

  // Create the PR via the appropriate VCS client
  const vcsClient = project.provider === "github"
    ? createGithubVcsClient(fetch)
    : createBitbucketVcsClient(fetch);

  const title = ticket.summary
    ? `Fix: ${ticket.summary}`
    : `Fix: ${ticket.key}`;
  const description = [
    ticket.description,
    ticket.url ? `\nSource: ${ticket.url}` : "",
    `\n---\nAutomated by Runchise pipeline • Ticket ${ticket.key}`,
  ].filter(Boolean).join("\n");

  // If a PR for this branch already exists (e.g. a previous run crashed after
  // creating it but before recording prUrl), reuse it instead of creating a duplicate.
  let prUrl: string;
  try {
    const existingPr = await vcsClient.findPullRequest({
      token,
      owner: project.owner,
      repoSlug: project.repoSlug,
      headBranch: branchName,
    });
    if (existingPr) {
      prUrl = existingPr.url;
    } else {
      const pr = await vcsClient.createPullRequest({
        token,
        owner: project.owner,
        repoSlug: project.repoSlug,
        title,
        headBranch: branchName,
        baseBranch: project.defaultBranch,
        description,
      });
      prUrl = pr.url;
    }
  } catch (err) {
    // Clean up the remote branch on failure
    try { execSync(`git -C "${repoPath}" push "${pushUrl}" --delete "${branchName}"`, { timeout: 10_000 }); } catch { /* ignore */ }
    return {
      ok: false,
      reason: `PR creation failed: ${err instanceof Error ? err.message : "unknown"}`,
      category: "agent_error",
    };
  }

  // Cleanup worktree
  if (worktreePath && existsSync(worktreePath)) {
    try {
      execSync(`git -C "${repoPath}" worktree remove --force "${worktreePath}"`, { timeout: 10_000 });
    } catch {
      try { rmSync(worktreePath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // Delete local branch (main repo never checks it out, so no checkout needed first)
  try {
    execSync(`git -C "${repoPath}" branch -D "${branchName}"`, { timeout: 10_000 });
  } catch { /* ignore */ }

  updateTicket(db, ticket.key, {
    status: "done",
    stage: "open_pr",
    prUrl,
    prSummary: `PR created against ${project.defaultBranch}`,
    finishedAt: new Date().toISOString(),
    worktreePath: null,
    branchName: null,
  });

  return { ok: true };
}
