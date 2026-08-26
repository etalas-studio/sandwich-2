import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { buildPrototypeSystemPrompt, buildPrototypeRefinePrompt } from "./prompts.js";
import {
  getDocumentFiles,
  getDocument,
  getVersion,
  getLatestVersion,
  saveDocumentFile,
} from "../db/documents.js";
import {
  fetchReferenceStyles,
  findReferenceUrls,
  writeReferencesToWorkspace,
  type ReferenceStyle,
} from "./webref.js";
import { copyReferencesTo } from "./references.js";
import { polishWorkspace } from "./glowup.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

const ENGINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** Format a `+Xs` elapsed marker (same style as glowup's event log). */
function elapsed(startMs: number): string {
  return `+${((Date.now() - startMs) / 1000).toFixed(1)}s`;
}

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export interface PrototypeGenerationResult {
  summary: string;
  files: string[];
  glowupWarning?: string;
}

export interface PrototypeGenerationInput {
  documentId: string;
  versionNo: number;
  brief: string;
  /** When present, edit the current version's files in place instead of generating fresh. */
  refine?: { instruction: string };
}

/**
 * Compose the user-facing prototype summary with an optional glowup-failure
 * note so a silent pass-1 fallback never reaches the user unnoticed.
 */
export function formatPrototypeSummary(summary: string, glowupWarning?: string): string {
  if (!glowupWarning) return summary;
  return `${summary}\n\nCatatan: ${glowupWarning}`;
}

/**
 * Generates a multi-file prototype into a workspace and saves the files under
 * the given document id (`document_files`). Chat-driven — the brief comes from
 * the conversation, not a form.
 */
export async function generatePrototypeDocument(
  db: Database,
  input: PrototypeGenerationInput,
  signal?: AbortSignal,
): Promise<PrototypeGenerationResult> {
  const workspace = mkdtempSync(join(tmpdir(), "prototype-"));
  const startedAt = Date.now();
  console.log(
    `[prototype] run start ${input.refine ? "refine" : "generate"} doc=${input.documentId} v${input.versionNo}`,
  );

  try {
    // Refine mode: seed the workspace with the current version's files so the
    // agent edits them in place instead of regenerating from scratch.
    if (input.refine) {
      const t0 = Date.now();
      const doc = await getDocument(db, input.documentId);
      const current = doc?.currentVersionId
        ? await getVersion(db, doc.currentVersionId)
        : await getLatestVersion(db, input.documentId);
      const sourceVersionNo = current?.versionNo ?? Math.max(1, input.versionNo - 1);
      const existing = await getDocumentFiles(db, input.documentId, sourceVersionNo);
      for (const file of existing) {
        const target = join(workspace, file.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
      }
      console.log(`[prototype] seeded ${existing.length} files from v${sourceVersionNo} in ${elapsed(t0)}`);
    }

    // Reference URL style (best-effort, multiple URLs + screenshot vision).
    // Writes .reference/<i>/ + index.json into the workspace.
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
        if (styles.length > 0) writeReferencesToWorkspace(workspace, styles);
        console.log(`[prototype] reference fetch done urls=${urls.length} matched=${styles.length} in ${elapsed(t0)}`);
      } catch {
        // ignore reference failures — fall back to the getokui library
        console.warn(`[prototype] reference fetch failed in ${elapsed(t0)}`);
      }
    }

    const systemPrompt = input.refine
      ? buildPrototypeRefinePrompt(input.brief, input.refine.instruction)
      : buildPrototypeSystemPrompt(input.brief, styles);

    const pi = await import("@earendil-works/pi-coding-agent");
    const { resolveModel } = await import("../model-runtime.js");
    const { runtime, model } = await resolveModel("prototype");
    console.log(`[prototype] start model=${model.provider}/${model.id} ${input.refine ? "refine" : "generate"} at ${new Date().toISOString()}`);

    const { session } = await pi.createAgentSession({
      cwd: workspace,
      model: model as any,
      modelRuntime: runtime as any,
      tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
      sessionManager: pi.SessionManager.inMemory(workspace),
      settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
    });

    let errorMessage = "";
    const sessionStart = Date.now();
    session.subscribe((event: any) => {
      if (signal?.aborted) return;
      if (event.type === "tool_execution_start") {
        console.log(`[prototype] ${elapsed(sessionStart)} tool_start=${event.toolName ?? "?"}`);
      } else if (event.type === "tool_execution_end") {
        console.log(`[prototype] ${elapsed(sessionStart)} tool_end=${event.toolName ?? "?"} isError=${event.isError ?? false}`);
      } else if (event.type === "agent_end" && typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
    });

    try {
      const promptPromise = session.prompt(systemPrompt);
      promptPromise.catch(() => {});
      await Promise.race([
        promptPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Prototype generation timed out")), ENGINE_TIMEOUT_MS),
        ),
      ]);
      await new Promise((r) => setTimeout(r, 500));
      session.dispose();
      if (errorMessage) throw new Error(errorMessage);
      console.log(`[prototype] session done in ${elapsed(sessionStart)}`);
    } catch (err) {
      session.dispose();
      console.warn(`[prototype] session FAILED in ${elapsed(sessionStart)}:`, err instanceof Error ? err.message : err);
      throw err;
    }

    // Glowup pass (best-effort, non-destructive): polish index.html + styles.css.
    // Skipped in refine mode — the user asked for a targeted change, and a
    // re-polish could overwrite it.
    let glowupWarning: string | undefined;
    if (!input.refine) {
      const t0 = Date.now();
      try {
        copyReferencesTo(workspace);
        await polishWorkspace(workspace, input.brief, signal);
        console.log(`[prototype] glowup done in ${elapsed(t0)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        glowupWarning = `polish desain (glowup) gagal dijalankan: ${msg}. Menampilkan hasil dasar.`;
        console.warn(`[prototype] glowup FAILED in ${elapsed(t0)}:`, msg);
      }
    }

    const t0 = Date.now();
    const files = listFilesRecursive(workspace);
    if (files.length === 0) throw new Error("no files generated");

    const saved: string[] = [];
    for (const fullPath of files) {
      const relPath = relative(workspace, fullPath).split("\\").join("/");
      if (relPath.startsWith(".")) continue; // skip .reference / .getokui
      const dot = relPath.lastIndexOf(".");
      const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = readFileSync(fullPath, "utf-8");
      const tFile = Date.now();
      await saveDocumentFile(db, input.documentId, input.versionNo, relPath, content);
      console.log(`[prototype] saved ${relPath} (${(content.length / 1024).toFixed(1)}KB) in ${elapsed(tFile)}`);
      saved.push(relPath);
    }
    console.log(`[prototype] saved ${saved.length} files total in ${elapsed(t0)}`);

    return {
      summary: `${input.refine ? "Refined" : "Generated"} ${saved.length} files: ${saved.join(", ")}`,
      files: saved,
      glowupWarning,
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    console.log(`[prototype] run end total ${elapsed(startedAt)}`);
  }
}
