import {
  createAgentSession,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { InvokerFactory } from "./run-scan.js";

export function createPiInvokerFactory(modelRuntime: unknown): InvokerFactory {
  return (modelId: string | null) => ({
    async run(opts) {
      if (!modelRuntime || !modelId) {
        throw new Error(
          modelId
            ? `Model "${modelId}" not available. Connect a provider in Settings → Integrations first.`
            : "No model selected. Choose a model from the dropdown before scanning.",
        );
      }

      const slashIdx = modelId.indexOf("/");
      if (slashIdx <= 0) {
        throw new Error(
          `Invalid model ID format: "${modelId}". Expected "provider/model".`,
        );
      }

      const provider = modelId.slice(0, slashIdx);
      const id = modelId.slice(slashIdx + 1);

      const rt = modelRuntime as { getModel(p: string, m: string): unknown };
      const model = rt.getModel(provider, id);
      if (!model) {
        throw new Error(
          `Model "${modelId}" not found. Make sure the provider is connected in Settings → Integrations.`,
        );
      }

      console.log("[scan] Starting agent pass with model:", modelId, "cwd:", opts.cwd);

      const { session } = await createAgentSession({
        cwd: opts.cwd,
        model: model as any,
        modelRuntime: modelRuntime as any,
        tools: ["read", "grep", "find", "ls"],
        sessionManager: SessionManager.inMemory(),
        settingsManager: SettingsManager.inMemory({
          compaction: { enabled: false },
        }),
      });

      let responseText = "";
      let toolCount = 0;

      session.subscribe((event: any) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_delta"
        ) {
          responseText += event.assistantMessageEvent.delta;
          // Log first chunk to confirm the agent is working
          if (responseText.length < 200 && event.assistantMessageEvent.delta.length > 0) {
            process.stdout.write(".");
          }
        }
        if (event.type === "tool_execution_start") {
          toolCount++;
          console.log(`[scan] Agent running tool: ${event.toolName}`);
        }
      });

      try {
        console.log("[scan] Sending prompt to agent...");
        await session.prompt(opts.prompt);
        console.log(""); // newline after dots
        console.log(`[scan] Agent finished. Used ${toolCount} tool calls, response ${responseText.length} chars.`);
        session.dispose();
        return { outcome: "ok" as const, finalText: responseText };
      } catch (err) {
        session.dispose();
        const message = err instanceof Error ? err.message : String(err);
        console.error("[scan] Agent pass failed:", message);
        if (
          message.includes("timeout") ||
          message.includes("aborted") ||
          message.includes("abort")
        ) {
          return { outcome: "timeout" as const, finalText: "" };
        }
        return { outcome: "process_error" as const, finalText: "" };
      }
    },
  });
}
