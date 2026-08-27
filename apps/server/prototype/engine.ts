import { existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { buildPrototypeSystemPrompt, buildPrototypeRefinePrompt, PROTOTYPE_FILE } from "./prompts.js";
import {
  fetchReferenceStyles,
  findReferenceUrls,
  writeReferencesToWorkspace,
  type ReferenceStyle,
} from "./webref.js";
import { resolveInsideProject } from "../projects/workspace.js";
import { createToolBudget, TOOL_BUDGETS } from "../engine/tool-budget.js";
import { scrubbedBashTool } from "../engine/bash-tool.js";

const ENGINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — outer backstop

/** Format a `+Xs` elapsed marker. */
function elapsed(startMs: number): string {
  return `+${((Date.now() - startMs) / 1000).toFixed(1)}s`;
}

export interface PrototypeGenerationResult {
  /** Always `prototype/index.html`. */
  relativePath: string;
  summary: string;
  /** Set when the run was cut short but a usable file exists. */
  warning?: string;
}

export interface PrototypeGenerationInput {
  /** The project's on-disk git working tree — the agent's cwd. */
  projectDir: string;
  conversationId: string;
  brief: string;
  /** When present, edit `prototype/index.html` in place instead of regenerating. */
  refine?: { instruction: string };
}

/**
 * Compose the user-facing prototype summary with an optional warning so a
 * cut-short run never reaches the user unnoticed.
 */
export function formatPrototypeSummary(summary: string, warning?: string): string {
  if (!warning) return summary;
  return `${summary}\n\nCatatan: ${warning}`;
}

/** True when `prototype/index.html` exists, is non-empty, and looks like HTML. */
export function verifyPrototypeOutput(projectDir: string): boolean {
  let path: string;
  try {
    path = resolveInsideProject(projectDir, PROTOTYPE_FILE);
  } catch {
    return false;
  }
  if (!existsSync(path)) return false;
  const html = readFileSync(path, "utf8").trim();
  if (html.length < 200) return false;
  return /<html|<!doctype html|<body|<div/i.test(html);
}

/**
 * Generates (or refines) a single self-contained `prototype/index.html` inside
 * the project directory. The agent writes the file itself via the write/edit
 * tools; the caller commits it. No database, no tmpdir.
 */
export async function generatePrototypeDocument(
  input: PrototypeGenerationInput,
  signal?: AbortSignal,
): Promise<PrototypeGenerationResult> {
  const { projectDir } = input;
  const startedAt = Date.now();
  const mode = input.refine ? "refine" : "generate";
  console.log(`[prototype] run start ${mode} conv=${input.conversationId}`);

  // Ensure prototype/ exists so `write prototype/index.html` never fails on a
  // missing dir (the agent has write, not mkdir).
  mkdirSync(dirname(resolveInsideProject(projectDir, PROTOTYPE_FILE)), { recursive: true });

  // Reference-URL style enrichment (best-effort). Writes .reference/ into cwd;
  // it's git-ignored (ensureGitignore) and cleaned up in `finally`.
  const styles: ReferenceStyle[] = [];
  const urls = input.refine ? [] : findReferenceUrls(input.brief);
  if (urls.length > 0) {
    const t0 = Date.now();
    try {
      const fetched = await Promise.race([
        fetchReferenceStyles(urls),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("reference enrichment timed out")), 60_000),
        ),
      ]);
      styles.push(...fetched);
      if (styles.length > 0) writeReferencesToWorkspace(projectDir, styles);
      console.log(`[prototype] reference fetch urls=${urls.length} matched=${styles.length} in ${elapsed(t0)}`);
    } catch {
      console.warn(`[prototype] reference fetch failed in ${elapsed(t0)}`);
    }
  }

  const systemPrompt = input.refine
    ? buildPrototypeRefinePrompt(input.brief, input.refine.instruction)
    : buildPrototypeSystemPrompt(input.brief, styles);

  try {
    const pi = await import("@earendil-works/pi-coding-agent");
    const { resolveModel } = await import("../model-runtime.js");
    const { runtime, model } = await resolveModel("prototype");
    console.log(`[prototype] start model=${model.provider}/${model.id} ${mode} at ${new Date().toISOString()}`);

    const { session } = await pi.createAgentSession({
      cwd: projectDir,
      model: model as never,
      modelRuntime: runtime as never,
      tools: ["read", "edit", "write", "grep", "find", "ls"],
      customTools: [await scrubbedBashTool(projectDir)] as never,
      sessionManager: pi.SessionManager.inMemory(projectDir),
      settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
    });

    const budget = createToolBudget(TOOL_BUDGETS.prototype);
    let errorMessage = "";
    let aborted = false;
    const sessionStart = Date.now();
    const enforce = (verdict: "ok" | "ceiling" | "stalled", how: string) => {
      if (verdict === "ok" || aborted) return;
      aborted = true;
      console.warn(`[prototype] budget ${verdict} (${how}) after ${budget.toolCalls} tool calls in ${elapsed(sessionStart)}`);
      session.abort();
    };

    session.subscribe((event: { type: string; toolName?: string; isError?: boolean; errorMessage?: string }) => {
      if (signal?.aborted) return;
      enforce(budget.onEvent(event.type, Date.now()), "event");
      if (event.type === "tool_execution_start") {
        console.log(`[prototype] ${elapsed(sessionStart)} tool_start=${event.toolName ?? "?"}`);
      } else if (event.type === "tool_execution_end") {
        console.log(`[prototype] ${elapsed(sessionStart)} tool_end=${event.toolName ?? "?"} isError=${event.isError ?? false}`);
      } else if (event.type === "agent_end" && typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
    });

    const poll = setInterval(() => enforce(budget.check(Date.now()), "idle"), 5_000);

    try {
      const promptPromise = session.prompt(systemPrompt);
      promptPromise.catch(() => {});
      await Promise.race([
        promptPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Prototype generation timed out")), ENGINE_TIMEOUT_MS),
        ),
      ]);
      await new Promise((r) => setTimeout(r, 300));
      session.dispose();
      console.log(`[prototype] session done in ${elapsed(sessionStart)} (budget=${budget.verdict}, tools=${budget.toolCalls})`);
    } catch (err) {
      session.dispose();
      console.warn(`[prototype] session ended in ${elapsed(sessionStart)}:`, err instanceof Error ? err.message : err);
      // fall through to the file check — a cut-short run may still have a file
    } finally {
      clearInterval(poll);
    }

    const verdict = budget.verdict;
    if (!verifyPrototypeOutput(projectDir)) {
      if (errorMessage) throw new Error(errorMessage);
      if (verdict === "ceiling") throw new Error("prototype run hit the tool-call ceiling before producing a file");
      if (verdict === "stalled") throw new Error("prototype run stalled before producing a file");
      throw new Error("no prototype file was produced");
    }

    const warning =
      verdict === "ok"
        ? undefined
        : `pembuatan prototype terhenti lebih awal (${verdict}). Menampilkan hasil sejauh ini.`;

    return {
      relativePath: PROTOTYPE_FILE,
      summary: input.refine ? "Prototype diperbarui." : "Prototype dibuat.",
      warning,
    };
  } finally {
    // Drop engine scratch so `ls` stays clean for the next run.
    for (const scratch of [".reference", ".getokui"]) {
      rmSync(resolveInsideProject(projectDir, scratch), { recursive: true, force: true });
    }
    console.log(`[prototype] run end total ${elapsed(startedAt)}`);
  }
}
