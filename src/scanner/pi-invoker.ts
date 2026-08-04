import {
  createAgentSession,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { InvokerFactory } from "./run-scan.js";

/**
 * Creates an InvokerFactory backed by the Pi SDK ModelRuntime.
 *
 * The agent session is configured with the full toolset (read, bash, edit,
 * write, grep, find, ls) so the agent can both explore and modify files.
 * The scanner runs in a throwaway worktree, so write access there is harmless.
 */
export function createPiInvokerFactory(modelRuntime: unknown): InvokerFactory {
  return (modelId: string | null) => ({
    async run(opts) {
      console.log("[invoker] run called, modelId =", modelId, "cwd =", opts.cwd);
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
        cwd: opts.cwd,
        model: model as any,
        modelRuntime: modelRuntime as any,
        tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
        sessionManager: SessionManager.inMemory(),
        settingsManager: SettingsManager.inMemory({
          compaction: { enabled: false },
        }),
      });
      console.log("[invoker] agent session created, sending prompt (length =", opts.prompt.length, ")");

      let responseText = "";

      session.subscribe((event: any) => {
        // Capture streaming text deltas (most common path)
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_delta"
        ) {
          responseText += event.assistantMessageEvent.delta;
          return;
        }
        // Fallback: text_end has the complete content block
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_end" &&
          !responseText
        ) {
          responseText = event.assistantMessageEvent.content ?? "";
          return;
        }
        // Fallback: turn_end carries the full assistant message
        if (event.type === "turn_end" && !responseText) {
          const content = event.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block?.type === "text" && block.text) {
                responseText += block.text;
              }
            }
          }
          return;
        }
        // Last resort: agent_end has all messages from the session
        if (event.type === "agent_end" && !responseText) {
          const messages = event.messages;
          if (Array.isArray(messages)) {
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              if (msg?.role === "assistant") {
                const content = msg.content;
                if (Array.isArray(content)) {
                  for (const block of content) {
                    if (block?.type === "text" && block.text) {
                      responseText += block.text;
                    }
                  }
                }
                if (responseText) break;
              }
            }
          }
        }
      });

      try {
        await session.prompt(opts.prompt);
        console.log("[invoker] session.prompt resolved, responseText length =", responseText.length);
        // Give event listeners a tick to flush before disposing
        await new Promise((r) => setTimeout(r, 100));
        session.dispose();
        return { outcome: "ok" as const, finalText: responseText };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[invoker] session.prompt threw:", message);
        session.dispose();
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
