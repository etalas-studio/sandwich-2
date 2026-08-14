import { mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildPrototypeSystemPrompt, buildReferenceContext } from "./prompts.js";
import { findReferenceUrls, fetchReferenceStyles, writeReferencesToWorkspace } from "./webref.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

// Prototype generation writes many files — give it a generous but bounded window.
const ENGINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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

export async function generatePrototype(
  db: Database,
  prototype: Prototype,
  signal?: AbortSignal,
): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), "prototype-"));

  // Reference-style enrichment — best-effort, never blocks generation.
  let referenceContext = "";
  try {
    const urls = findReferenceUrls(prototype.brief);
    if (urls.length > 0) {
      const enrichment = (async () => {
        const styles = await fetchReferenceStyles(urls);
        if (styles.length > 0) {
          writeReferencesToWorkspace(workspace, styles);
          return buildReferenceContext(styles);
        }
        return "";
      })();
      referenceContext = await Promise.race([
        enrichment,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("reference enrichment timed out")), 60_000),
        ),
      ]);
      if (referenceContext) {
        console.log(
          `[prototype] reference enrichment: ${urls.length} url(s) → ${referenceContext.length} chars of style context`,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[prototype] reference enrichment failed:",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const pi = await import("@earendil-works/pi-coding-agent");

    const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null });
    const provider = process.env.OPENCODE_PROVIDER ?? "opencode-go";
    const modelId = process.env.OPENCODE_MODEL ?? "deepseek-v4-pro";
    const model = modelRuntime.getModel(provider, modelId);
    if (!model) {
      throw new Error(`OpenCode model not available: ${provider}/${modelId}`);
    }
    const { session } = await pi.createAgentSession({
      cwd: workspace,
      model: model as any,
      modelRuntime: modelRuntime as any,
      tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
      sessionManager: pi.SessionManager.inMemory(workspace),
      settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
    });

    let errorMessage = "";
    let finished = false;
    let responseText = "";

    session.subscribe((event: any) => {
      if (signal?.aborted) return;
      if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        responseText += event.assistantMessageEvent.delta;
      }
      if (event.type === "agent_end") {
        finished = true;
        if (typeof event.errorMessage === "string" && event.errorMessage) {
          errorMessage = event.errorMessage;
        }
      }
    });

    const systemPrompt = buildPrototypeSystemPrompt({
      brief: prototype.brief,
      palette: prototype.palette,
      logoData: prototype.logoData,
      ...(referenceContext ? { referenceContext } : {}),
    });

    try {
      const promptPromise = session.prompt(systemPrompt);
      promptPromise.catch(() => {}); // avoid unhandled rejection on timeout
      await Promise.race([
        promptPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Prototype generation timed out")), ENGINE_TIMEOUT_MS),
        ),
      ]);
      // Small delay for agent_end event to propagate
      await new Promise((r) => setTimeout(r, 500));
      session.dispose();

      if (errorMessage) throw new Error(errorMessage);
    } catch (err) {
      session.dispose();
      throw err;
    }

    // Read all generated files from workspace
    const files = listFilesRecursive(workspace);
    console.log("[prototype] workspace files:", files.map((f) => relative(workspace, f)));
    console.log("[prototype] agent response (first 500 chars):", responseText.slice(0, 500));
    if (files.length === 0) throw new Error("no files generated");

    for (const fullPath of files) {
      const relPath = relative(workspace, fullPath).split("\\").join("/");
      const dot = relPath.lastIndexOf(".");
      const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = readFileSync(fullPath, "utf-8");
      await savePrototypeFile(db, prototype.id, relPath, content);
    }

    await updatePrototypeStatus(db, prototype.id, "done");
  } catch (err) {
    await updatePrototypeStatus(db, prototype.id, "failed");
    throw err;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
