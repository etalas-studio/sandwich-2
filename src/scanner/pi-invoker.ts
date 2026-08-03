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

      const { session } = await createAgentSession({
        model: model as any,
        modelRuntime: modelRuntime as any,
        tools: ["read", "grep", "find", "ls"],
        sessionManager: SessionManager.inMemory(),
        settingsManager: SettingsManager.inMemory({
          compaction: { enabled: false },
        }),
      });

      let responseText = "";

      session.subscribe((event: any) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_delta"
        ) {
          responseText += event.assistantMessageEvent.delta;
        }
      });

      try {
        await session.prompt(opts.prompt);
        session.dispose();
        return { outcome: "ok" as const, finalText: responseText };
      } catch (err) {
        session.dispose();
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("timeout") ||
          message.includes("aborted") ||
          message.includes("abort")
        ) {
          return { outcome: "timeout" as const, finalText: "" };
        }
        console.error("Agent pass engine error:", message);
        return { outcome: "process_error" as const, finalText: "" };
      }
    },
  });
}
