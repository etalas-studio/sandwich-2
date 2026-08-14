import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { copyReferencesTo, readPrototypeFiles } from "./references.js";
import { polishWorkspace } from "./glowup.js";
import { findReferenceUrl, fetchReferenceStyle, writeReferenceToWorkspace, type ReferenceStyle } from "./webref.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";

// Prototype generation writes many files — give it a generous but bounded window.
const ENGINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function generatePrototype(
  db: Database,
  prototype: Prototype,
  signal?: AbortSignal,
): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), "prototype-"));

  try {
    // Optional client reference website (style source). Best-effort; fallback to getokui on failure.
    const referenceUrl = findReferenceUrl(prototype.brief);
    let referenceStyle: ReferenceStyle | null = null;
    if (referenceUrl) {
      try {
        referenceStyle = await fetchReferenceStyle(referenceUrl);
        if (referenceStyle) {
          writeReferenceToWorkspace(workspace, referenceStyle);
          console.log("[prototype] reference style extracted:", referenceUrl);
        } else {
          console.warn("[prototype] reference fetch failed, using getokui:", referenceUrl);
        }
      } catch (err) {
        console.warn("[prototype] reference extraction failed, using getokui:", err);
        referenceStyle = null;
      }
    }

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
      referenceUrl: referenceStyle?.url ?? null,
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

    // Read pass-1 files (snapshot kept as fallback if glowup fails)
    let files = readPrototypeFiles(workspace);
    console.log("[prototype] generated files:", files.map((f) => f.path));
    console.log("[prototype] agent response (first 500 chars):", responseText.slice(0, 500));
    if (files.length === 0) throw new Error("no files generated");

    // Design polish pass (getokui glowup). Non-destructive: on failure, keep pass-1 files.
    try {
      copyReferencesTo(workspace);
      await polishWorkspace(workspace, prototype.brief, referenceStyle?.url ?? null, signal);
      const polished = readPrototypeFiles(workspace);
      if (polished.length > 0) files = polished;
      console.log("[prototype] glowup complete");
    } catch (err) {
      console.error("[prototype] glowup failed, keeping original files:", err);
    }

    for (const file of files) {
      await savePrototypeFile(db, prototype.id, file.path, file.content);
    }

    await updatePrototypeStatus(db, prototype.id, "done");
  } catch (err) {
    await updatePrototypeStatus(db, prototype.id, "failed");
    throw err;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
