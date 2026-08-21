import { ModelRuntime } from "@earendil-works/pi-coding-agent";

let runtimePromise: Promise<typeof ModelRuntime.prototype> | null = null;

async function fetch9RouterModels(baseUrl: string, apiKey: string) {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      reasoning: false,
      input: ["text"] as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 8_192,
    }));
  } catch {
    return [];
  }
}

/**
 * Pi SDK injects a system prompt with absolute local paths like
 * /Users/adib/.../node_modules/... that 9router's WAF blocks as path
 * traversal. Patch globalThis.fetch once to strip the system message
 * from any request to 9router's chat/completions endpoint.
 */
function patch9RouterFetch(baseUrl: string): void {
  // Idempotent — only patch once
  if ((globalThis as any).__9routerFetchPatched) return;
  (globalThis as any).__9routerFetchPatched = true;

  const origFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async function patchedFetch(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);
    if (url.startsWith(baseUrl) && url.includes("chat/completions") && init?.body) {
      try {
        const body = JSON.parse(String(init.body)) as { messages?: Array<{ role: string; content: unknown }> };
        if (Array.isArray(body.messages)) {
          body.messages = body.messages.filter((m) => m.role !== "system");
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch { /* leave as-is on parse failure */ }
    }
    return origFetch(input as any, init);
  };
}

export function getModelRuntime(): Promise<typeof ModelRuntime.prototype> {
  if (!runtimePromise) {
    runtimePromise = ModelRuntime.create({ modelsPath: null }).then(async (rt) => {
      const rawUrl = process.env.NINEROUTER_URL?.replace(/\/+$/, "");
      if (rawUrl) {
        const baseUrl = rawUrl.endsWith("/v1") ? rawUrl : `${rawUrl}/v1`;
        const apiKey = process.env.NINEROUTER_KEY ?? "no-key";
        const models = await fetch9RouterModels(baseUrl, apiKey);
        patch9RouterFetch(baseUrl);
        rt.registerProvider("9router", {
          name: "9Router",
          baseUrl,
          apiKey,
          api: "openai-completions" as any,
          models,
        });
        console.log(`[model-runtime] 9router registered: ${baseUrl} (${models.length} models)`);
      }
      return rt;
    });
  }
  return runtimePromise;
}
