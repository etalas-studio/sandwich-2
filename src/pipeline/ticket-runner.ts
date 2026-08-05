import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { getTicket, updateTicket } from "../db/tickets.js";
import type { Ticket } from "../db/tickets.js";
import { getBlocklistEntries } from "../db/blocklist.js";
import { getCurrentProject } from "../db/project.js";
import { getValidOAuthToken, getOAuthToken } from "./oauth-integrations.js";
import { buildCloneUrl } from "./project-clone.js";
import { createGithubVcsClient } from "./vcs-github.js";
import { createBitbucketVcsClient } from "./vcs-bitbucket.js";
import type { InvokerFactory } from "../scanner/run-scan.js";

/**
 * Downloads ticket attachments from Jira into a local directory.
 * If token is null or attachmentsJson is empty/nil, does nothing.
 * Individual download failures are logged and skipped — the pipeline
 * should not block because one screenshot URL is broken.
 */
export async function downloadAttachments(
  attachmentsJson: string | null,
  destDir: string,
  token: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (!token || !attachmentsJson) return;

  let attachments: Array<{ filename: string; mimeType: string; size: number; url: string }>;
  try {
    attachments = JSON.parse(attachmentsJson);
  } catch {
    return;
  }

  if (!Array.isArray(attachments) || attachments.length === 0) return;

  mkdirSync(destDir, { recursive: true });

  const usedNames = new Set<string>();

  for (const att of attachments) {
    if (!att.url || !att.filename) continue;

    // Deduplicate filenames
    let filename = att.filename;
    if (usedNames.has(filename)) {
      const ext = extname(filename);
      const base = filename.slice(0, filename.length - ext.length);
      let counter = 2;
      while (usedNames.has(`${base}-${counter}${ext}`)) {
        counter++;
      }
      filename = `${base}-${counter}${ext}`;
    }
    usedNames.add(filename);

    const dest = join(destDir, filename);
    try {
      const res = await fetchFn(att.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`Attachment download failed (${res.status}): ${att.filename} from ${att.url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
    } catch (err) {
      console.error(`Attachment download error: ${att.filename} — ${err instanceof Error ? err.message : "unknown"}`);
      // Continue to next attachment
    }
  }
}

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
        case "open_pr": {
          // Check if auto-open-PR is disabled in settings
          const project = getCurrentProject(db);
          if (project && !project.autoOpenPr) {
            const content = await generatePrContent(db, ticket, modelId, createInvoker);
            updateTicket(db, ticketKey, {
              status: "done",
              stage: "open_pr",
              prTitle: content.title,
              prDescription: content.description,
              prSummary: "PR content ready — click Open PR to create.",
              finishedAt: new Date().toISOString(),
            });
            emit({ type: "stage_end", stage: "open_pr", ticket: getTicket(db, ticketKey)! });
            emit({ type: "done", ticket: getTicket(db, ticketKey)! });
            return;
          }
          result = await runOpenPr(db, ticket, repoPath, createInvoker, modelId, emit, signal);
          break;
        }
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

  // Cleanup attachment cache
  const attachmentCacheDir = `data/attachments/${ticketKey}`;
  if (existsSync(attachmentCacheDir)) {
    try {
      rmSync(attachmentCacheDir, { recursive: true, force: true });
    } catch {
      // Not fatal — stale cache dirs don't hurt anything
    }
  }

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

  // Download ticket attachments so the judge agent can inspect screenshots/logs
  const attachmentsDir = `data/attachments/${ticket.key}`;
  const jiraToken = getOAuthToken("jira");
  await downloadAttachments(ticket.attachments, attachmentsDir, jiraToken);

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
    `For second chances (small missing decision with clear options), add a "choices" array: ${allowChoices ? '{"agentReady": false, "reason": "...", "choices": [{"label": "Use Prettier", "description": "Project already has .prettierrc", "inject": "Format code with Prettier (npx prettier --write)"}]}' : "choices are NOT allowed on this ticket — just use ambiguous_ticket"}`,
    "Each choice needs: label (short), description (why this option), inject (the text to add to the ticket description when chosen). Max 3 choices.",
    "",
    ticket.summary ? `Ticket title: ${ticket.summary}` : "",
    `Ticket key: ${ticket.key}`,
    `Ticket description: ${ticket.description}`,
    ticket.url ? `Ticket URL: ${ticket.url}` : "",
    ...(ticket.attachments
      ? [
          "",
          `Attachments are available at ${attachmentsDir}/ — read them for visual context (screenshots, diagrams, log files, etc.).`,
        ]
      : []),
  ]
    .filter(Boolean)
    .join("\n");

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
        const choices = parsed.choices
          ?.slice(0, 3)
          .filter(
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

  // Check for cached attachments before worktree creation so the flag is available
  // for the prompt guard even if worktree creation fails (early return).
  const attachmentsCacheDir = `data/attachments/${ticket.key}`;
  const hasAttachments = existsSync(attachmentsCacheDir);

  try {
    execSync(`mkdir -p "${worktreesDir}"`, { encoding: "utf-8" });
    // Refresh the default branch so new tickets branch off latest remote, not a stale local HEAD
    execSync(`git -C "${repoPath}" fetch origin "${defaultBranch}"`, {
      encoding: "utf-8",
      timeout: 30_000,
    });
    // Create branch + worktree in one step, off the fresh remote ref — never touches
    // the main repo's checkout, so it's safe to run for multiple tickets concurrently.
    execSync(
      `git -C "${repoPath}" worktree add -b "${branchName}" "${worktreePath}" "origin/${defaultBranch}"`,
      { encoding: "utf-8", timeout: 30_000 },
    );

    // Configure git identity in the worktree so the agent can commit
    execSync(`git -C "${worktreePath}" config user.name "Runchise Agent"`, { encoding: "utf-8" });
    execSync(`git -C "${worktreePath}" config user.email "agent@runchise.local"`, {
      encoding: "utf-8",
    });

    updateTicket(db, ticket.key, { worktreePath, branchName });

    // Copy cached attachments into the worktree so the agent can read them
    // (hasAttachments computed above, outside the try)
    if (hasAttachments) {
      const worktreeAttachmentsDir = join(worktreePath, ".attachments");
      try {
        execSync(`mkdir -p "${worktreeAttachmentsDir}"`, { encoding: "utf-8" });
        execSync(`cp -R "${attachmentsCacheDir}"/. "${worktreeAttachmentsDir}"/`, {
          encoding: "utf-8",
        });
      } catch (err) {
        console.warn(
          `Attachment copy to worktree failed: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }
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
    ...(hasAttachments
      ? [
          "",
          "Ticket attachments (screenshots, logs, documents) are in the .attachments/ directory — read them for visual context.",
        ]
      : []),
    "",
    "When done, your final message should summarize what you changed.",
  ]
    .filter(Boolean)
    .join("\n");

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
        execSync(
          `git -C "${worktreePath}" commit -m "${ticket.key}: ${ticket.summary ?? ticket.description.slice(0, 60)}"`,
          {
            encoding: "utf-8",
            timeout: 10_000,
          },
        );
      }
    } catch {
      // Commit failed — fall through to the mechanical check below
    }

    // Mechanical guard: the agent must produce actual changes (committed or
    // uncommitted). An empty worktree means the agent hallucinated success.
    const hasUncommitted = execSync(`git -C "${worktreePath}" status --porcelain`, {
      encoding: "utf-8",
    }).trim();
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
    const status = execSync(`git -C "${fresh.worktreePath}" status --porcelain`, {
      encoding: "utf-8",
    });
    if (status.trim()) {
      execSync(`git -C "${fresh.worktreePath}" add -A`, { encoding: "utf-8", timeout: 10_000 });
      execSync(
        `git -C "${fresh.worktreePath}" commit -m "${ticket.key}: auto-commit uncommitted changes"`,
        {
          encoding: "utf-8",
          timeout: 10_000,
        },
      );
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
  ]
    .filter(Boolean)
    .join("\n");

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
    const parsed = JSON.parse(jsonMatch[0]) as {
      ok?: boolean;
      summary?: string;
      warnings?: string[];
    };
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

// ── AI PR Content Generation ──

interface PrPromptInput {
  ticketKey: string;
  ticketSummary: string | null;
  ticketDescription: string;
  ticketUrl: string | null;
  diffStat: string;
  verifySummary: string | null;
  verifyWarnings: string[];
}

export function buildPrPrompt(input: PrPromptInput): string {
  const parts = [
    "You are writing a pull request description for a code change you implemented.",
    "",
    "First, review the diff and commit messages to understand what changed.",
    "",
    `Ticket: ${input.ticketKey}`,
    input.ticketSummary ? `Title: ${input.ticketSummary}` : "",
    `Description: ${input.ticketDescription}`,
    input.ticketUrl ? `URL: ${input.ticketUrl}` : "",
    "",
    "Diff summary:",
    input.diffStat || "(no diff available)",
    "",
    input.verifySummary ? `Verification result: ${input.verifySummary}` : "",
    input.verifyWarnings.length > 0
      ? `Warnings: ${input.verifyWarnings.join("; ")}`
      : "",
    "",
    "Generate a PR title and description. The description MUST use this markdown format:",
    "",
    "## Linked Issue",
    "[<ticket key>](<ticket url>) — <ticket summary or description>",
    "",
    "## What Changed",
    "<2-4 sentence summary of what was changed and why>",
    "",
    "## Changes",
    "- `<file>` — <brief explanation>",
    "...",
    "",
    "## How Tested",
    "<test results from verification>",
    "",
    "## Verification Notes",
    "<warnings if any, otherwise omit this section>",
    "",
    "---",
    "> \u26a0\ufe0f **AI-Generated PR** — This code was written by an AI agent (Runchise pipeline).",
    "> A human MUST review before merging.",
    "",
    "Title should follow conventional commit format: type: short description (max 72 chars).",
    "",
    "Answer ONLY with a JSON object:",
    '{"title": "type: concise description", "description": "full markdown description as above"}',
  ];

  return parts.filter((p) => p !== "").join("\n");
}

export function parsePrResponse(text: string): { title: string; description: string } | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      description?: string;
    };
    if (
      typeof parsed.title === "string" &&
      parsed.title.length > 0 &&
      typeof parsed.description === "string" &&
      parsed.description.length > 0
    ) {
      return { title: parsed.title, description: parsed.description };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Stage: Open PR ──

/**
 * Mechanical fallback PR title from ticket info.
 */
function mechanicalPrTitle(ticket: Ticket): string {
  return ticket.summary ? `Fix: ${ticket.summary}` : `Fix: ${ticket.key}`;
}

/**
 * Mechanical fallback PR description from ticket info.
 */
function mechanicalPrDescription(ticket: Ticket): string {
  return [
    ticket.description,
    ticket.url ? `\nSource: ${ticket.url}` : "",
    `\n---\nAutomated by Runchise pipeline • Ticket ${ticket.key}`,
  ].filter(Boolean).join("\n");
}

export interface PrContent {
  title: string;
  description: string;
}

/**
 * Generate PR title and description. Uses AI when modelId is provided,
 * falls back to a mechanical template otherwise.
 */
export async function generatePrContent(
  db: Database.Database,
  ticket: Ticket,
  modelId: string | null,
  createInvoker?: InvokerFactory,
): Promise<PrContent> {
  const fresh = getTicket(db, ticket.key);
  const project = getCurrentProject(db);

  if (modelId && createInvoker && fresh?.worktreePath && project) {
    try {
      const diffStat = execSync(
        `git -C "${fresh.worktreePath}" diff --stat "origin/${project.defaultBranch}"..HEAD`,
        { encoding: "utf-8" },
      );
      const verifyNote = fresh.needsHumanReason ?? "";
      const warnings = verifyNote.startsWith("[WARNINGS]")
        ? verifyNote.slice(10).split("; ").map((s) => s.trim())
        : [];
      const verifySummary = verifyNote && !verifyNote.startsWith("[WARNINGS]")
        ? verifyNote
        : null;

      const invoker = createInvoker(modelId);
      const prompt = buildPrPrompt({
        ticketKey: ticket.key,
        ticketSummary: ticket.summary,
        ticketDescription: ticket.description,
        ticketUrl: ticket.url,
        diffStat: diffStat.trim() || "(no diff available)",
        verifySummary,
        verifyWarnings: warnings,
      });

      const result = await invoker.run({
        prompt,
        cwd: fresh.worktreePath,
        timeoutMs: 60_000,
      });

      if (result.outcome === "ok") {
        const parsed = parsePrResponse(result.finalText);
        if (parsed) {
          return { title: parsed.title, description: parsed.description };
        }
      }
    } catch {
      // AI generation failed — fall through to mechanical
    }
  }

  return {
    title: mechanicalPrTitle(ticket),
    description: mechanicalPrDescription(ticket),
  };
}

/**
 * Execute the mechanical parts of opening a PR: git push, create PR via
 * VCS API, cleanup worktree and branch.
 */
export async function executePr(
  db: Database.Database,
  ticketKey: string,
  repoPath: string,
  title: string,
  description: string,
): Promise<string> {
  const fresh = getTicket(db, ticketKey);
  const branchName = fresh?.branchName;
  const worktreePath = fresh?.worktreePath;

  const project = getCurrentProject(db);
  if (!project || project.cloneStatus !== "ready") {
    throw new Error("No project configured");
  }

  const token = await getValidOAuthToken(project.provider);
  if (!token) {
    throw new Error(`${project.provider} is not connected or its token expired — reconnect it`);
  }

  if (!branchName) {
    throw new Error("No branch name — implement stage may have failed");
  }

  // Push branch
  const pushUrl = buildCloneUrl(project.provider, project.owner, project.repoSlug, token);
  try {
    execSync(`git -C "${repoPath}" push "${pushUrl}" "${branchName}"`, {
      encoding: "utf-8",
      timeout: 30_000,
    });
  } catch (err) {
    throw new Error(
      `Failed to push branch: ${redactToken(err instanceof Error ? err.message : "unknown", token)}`,
    );
  }

  // Create PR via VCS
  const vcsClient =
    project.provider === "github" ? createGithubVcsClient(fetch) : createBitbucketVcsClient(fetch);

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
    try {
      execSync(`git -C "${repoPath}" push "${pushUrl}" --delete "${branchName}"`, {
        timeout: 10_000,
      });
    } catch {
      /* ignore */
    }
    throw new Error(`PR creation failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Cleanup worktree
  if (worktreePath && existsSync(worktreePath)) {
    try {
      execSync(`git -C "${repoPath}" worktree remove --force "${worktreePath}"`, {
        timeout: 10_000,
      });
    } catch {
      try {
        rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  // Delete local branch
  try {
    execSync(`git -C "${repoPath}" branch -D "${branchName}"`, { timeout: 10_000 });
  } catch {
    /* ignore */
  }

  updateTicket(db, ticketKey, {
    status: "done",
    stage: "open_pr",
    prUrl,
    prSummary: `PR created against ${project.defaultBranch}`,
    finishedAt: new Date().toISOString(),
    worktreePath: null,
    branchName: null,
  });

  return prUrl;
}

async function runOpenPr(
  db: Database.Database,
  ticket: Ticket,
  repoPath: string,
  createInvoker: InvokerFactory,
  modelId: string | null,
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  try {
    const content = await generatePrContent(db, ticket, modelId, createInvoker);
    const prUrl = await executePr(db, ticket.key, repoPath, content.title, content.description);

    emit({ type: "stage_end", stage: "open_pr", ticket: getTicket(db, ticket.key)! });
    emit({ type: "done", ticket: getTicket(db, ticket.key)! });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "open_pr failed",
      category: "agent_error",
    };
  }
}
