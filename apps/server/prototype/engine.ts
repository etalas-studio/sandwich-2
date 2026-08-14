import { mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { saveDocumentFile } from "../db/documents.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

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

export interface PrototypeGenerationResult {
  summary: string;
  files: string[];
}

/**
 * Generates a multi-file prototype into a workspace and saves the files under
 * the given document id (`document_files`). Chat-driven — the brief comes from
 * the conversation, not a form.
 */
export async function generatePrototypeDocument(
  db: Database,
  input: { documentId: string; brief: string },
  signal?: AbortSignal,
): Promise<PrototypeGenerationResult> {
  const workspace = mkdtempSync(join(tmpdir(), "prototype-"));

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
    session.subscribe((event: any) => {
      if (signal?.aborted) return;
      if (event.type === "agent_end" && typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
    });

    const systemPrompt = buildPrototypeSystemPrompt(input.brief);

    try {
      const promptPromise = session.prompt(systemPrompt);
      promptPromise.catch(() => {}); // avoid unhandled rejection on timeout
      await Promise.race([
        promptPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Prototype generation timed out")), ENGINE_TIMEOUT_MS),
        ),
      ]);
      await new Promise((r) => setTimeout(r, 500));
      session.dispose();
      if (errorMessage) throw new Error(errorMessage);
    } catch (err) {
      session.dispose();
      throw err;
    }

    const files = listFilesRecursive(workspace);
    if (files.length === 0) throw new Error("no files generated");

    const saved: string[] = [];
    for (const fullPath of files) {
      const relPath = relative(workspace, fullPath).split("\\").join("/");
      const dot = relPath.lastIndexOf(".");
      const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = readFileSync(fullPath, "utf-8");
      await saveDocumentFile(db, input.documentId, relPath, content);
      saved.push(relPath);
    }

    return { summary: `Generated ${saved.length} files: ${saved.join(", ")}`, files: saved };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
