import { mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

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

  try {
    const pi = await import("@earendil-works/pi-coding-agent");

    const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null });
    const model = modelRuntime.getModel("opencode-go", "gpt-5.1");
    if (!model) throw new Error("OpenCode model not available");
    const { session } = await pi.createAgentSession({
      cwd: workspace,
      model: model as any,
      modelRuntime: modelRuntime as any,
      tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
      sessionManager: pi.SessionManager.inMemory(),
      settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
    });

    let errorMessage = "";
    let finished = false;

    session.subscribe((event: any) => {
      if (signal?.aborted) return;
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
    });

    try {
      await session.prompt(systemPrompt);
      // Small delay for agent_end event to propagate
      await new Promise((r) => setTimeout(r, 200));
      session.dispose();

      if (errorMessage) throw new Error(errorMessage);
    } catch (err) {
      session.dispose();
      throw err;
    }

    // Read all generated files from workspace
    const files = listFilesRecursive(workspace);
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
