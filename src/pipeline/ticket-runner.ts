import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getTicket, updateTicket } from "../db/tickets.js";
import type { Ticket } from "../db/tickets.js";
import { getBlocklistEntries } from "../db/blocklist.js";
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
          result = await runOpenPr(db, ticket, emit, signal);
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
        updateInput.needsHumanCategory = "quick_win";
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

  // Cap quick-win rounds at 1
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
    "- If there IS a small missing decision (e.g. 'which formatter' when Prettier is already configured) and the answer comes down to 2-3 clear options informed by the codebase, return choices. This is a 'quick win'.",
    "- Only block as truly ambiguous if the gap would fundamentally change the implementation approach or the codebase provides no hints.",
    "",
    "Answer ONLY with a JSON object:",
    '{"agentReady": true/false, "reason": "one short sentence explaining why"}',
    "",
    `For quick wins (small missing decision with clear options), add a "choices" array: ${allowChoices ? '{"agentReady": false, "reason": "...", "choices": [{"label": "Use Prettier", "description": "Project already has .prettierrc", "inject": "Format code with Prettier (npx prettier --write)"}]}' : 'choices are NOT allowed on this ticket — just use ambiguous_ticket'}`,
    "Each choice needs: label (short), description (why this option), inject (the text to add to the ticket description when chosen). Max 3 choices.",
    "",
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
            category: "quick_win",
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

  // Create worktree
  const worktreeName = `ticket-${ticket.key}-${randomUUID().slice(0, 6)}`.toLowerCase();
  const worktreesDir = join(repoPath, ".worktrees");
  const worktreePath = join(worktreesDir, worktreeName);

  try {
    execSync(`mkdir -p "${worktreesDir}"`, { encoding: "utf-8" });
    execSync(`git -C "${repoPath}" worktree add "${worktreePath}" HEAD`, {
      encoding: "utf-8",
      timeout: 30_000,
    });

    updateTicket(db, ticket.key, { worktreePath });
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

  const invoker = createInvoker(modelId);
  const prompt = [
    "Review your own implementation. Check:",
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
  ].join("\n");

  try {
    const result = await invoker.run({
      prompt,
      cwd: fresh.worktreePath,
      timeoutMs: 120_000,
    });

    const jsonMatch = result.finalText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
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
  emit: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<StageResult> {
  const fakePrUrl = `https://github.com/etalas/runchise/pull/fake-${randomUUID().slice(0, 8)}`;

  // Refetch — worktreePath was set during implement stage
  const fresh = getTicket(db, ticket.key);
  const worktreePath = fresh?.worktreePath;

  // Cleanup worktree
  if (worktreePath && existsSync(worktreePath)) {
    try {
      execSync(`git -C "${worktreePath}" worktree remove --force "${worktreePath}" 2>/dev/null || rm -rf "${worktreePath}"`, {
        timeout: 10_000,
      });
    } catch {
      try { rmSync(worktreePath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  updateTicket(db, ticket.key, {
    status: "done",
    stage: "open_pr",
    prUrl: fakePrUrl,
    prSummary: "Implementation complete. (Fake PR — PR creation is out of scope.)",
    finishedAt: new Date().toISOString(),
    worktreePath: null,
  });

  return { ok: true };
}
