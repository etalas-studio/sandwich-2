import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Pi SDK integration layer.
 *
 * OpenCode ("opencode") and OpenAI Codex ("openai-codex") are BUILT-IN
 * providers in Pi.  No models.json required — ModelRuntime.create() picks
 * them up automatically from the shipped provider catalog.
 *
 * - opencode / opencode-go:  API key auth (OPENCODE_API_KEY env var or runtime key).
 * - openai-codex:             OAuth-only (ChatGPT Plus/Pro subscription via /login).
 *
 * IMPORTANT: Uses project-local config/auth.json, NOT the host machine's
 * ~/.pi/agent/auth.json.  The server starts with no pre-existing credentials
 * — all keys come from the web UI at runtime.
 */

const AUTH_PATH = "config/auth.json";

let modelRuntime: Awaited<ReturnType<typeof ModelRuntime.create>> | null = null;

export async function initIntegrations(): Promise<void> {
  modelRuntime = await ModelRuntime.create({
    authPath: AUTH_PATH,
    modelsPath: null,
  });
  const providerIds = modelRuntime.getProviders().map((p) => p.id);
  console.log(
    `Integrations: loaded ${providerIds.length} providers (${providerIds.join(", ")})`,
    existsSync(AUTH_PATH) ? "(with project auth)" : "(clean state)",
  );
}

// ────────────────────────────────────────────────────────────
// Status
// ────────────────────────────────────────────────────────────

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  authType: "api_key" | "oauth" | "none";
  models: Array<{ id: string; name: string }>;
  error?: string;
}

const PROVIDER_META: Record<string, { name: string; modelNames: Array<{ id: string; name: string }> }> = {
  opencode: {
    name: "OpenCode Zen",
    modelNames: [
      { id: "kimi-k2.6", name: "Kimi K2.6" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { id: "gpt-5.1", name: "GPT-5.1" },
    ],
  },
  "opencode-go": {
    name: "OpenCode Go",
    modelNames: [
      { id: "kimi-k2.6", name: "Kimi K2.6" },
      { id: "kimi-k2.7-code", name: "Kimi K2.7 Code" },
      { id: "kimi-k3", name: "Kimi K3" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
      { id: "qwen3.7-max", name: "Qwen3.7 Max" },
      { id: "minimax-m3", name: "MiniMax-M3" },
      { id: "grok-4.5", name: "Grok 4.5" },
    ],
  },
  "openai-codex": {
    name: "OpenAI Codex",
    modelNames: [
      { id: "gpt-5.5", name: "GPT-5.5" },
      { id: "gpt-5.1", name: "GPT-5.1" },
      { id: "gpt-5-codex", name: "GPT-5 Codex" },
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
    ],
  },
};

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  if (!modelRuntime) {
    return Object.entries(PROVIDER_META).map(([id, meta]) => ({
      id,
      name: meta.name,
      connected: false,
      authType: "none" as const,
      models: [],
      error: "integration runtime not initialized",
    }));
  }

  const results: IntegrationStatus[] = [];

  for (const [providerId, meta] of Object.entries(PROVIDER_META)) {
    try {
      const usesOAuth = modelRuntime.isUsingOAuth(providerId);
      const authCheck = await modelRuntime.checkAuth(providerId);
      const connected = authCheck !== undefined;
      const runtimeModels: Array<{ id: string; name: string }> = connected
        ? modelRuntime.getModels(providerId).map((m) => ({ id: `${m.provider}/${m.id}`, name: m.name }))
        : [];

      results.push({
        id: providerId,
        name: meta.name,
        connected,
        authType: usesOAuth ? "oauth" : "api_key",
        models: runtimeModels,
        error: connected ? undefined : (usesOAuth ? "OAuth not configured — login via Pi CLI" : "API key not set"),
      });
    } catch (err) {
      results.push({
        id: providerId,
        name: meta.name,
        connected: false,
        authType: "none",
        models: [],
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────
// Persist API keys to config/auth.json so they survive restarts.
// ────────────────────────────────────────────────────────────

function readAuthFile(): Record<string, unknown> {
  if (!existsSync(AUTH_PATH)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeAuthFile(data: Record<string, unknown>): void {
  mkdirSync(dirname(AUTH_PATH), { recursive: true });
  writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

// ────────────────────────────────────────────────────────────
// Connect / Disconnect
// ────────────────────────────────────────────────────────────

export async function connectWithApiKey(providerId: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (!modelRuntime) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  if (providerId !== "opencode" && providerId !== "opencode-go") {
    return { ok: false, message: `${providerId} does not support API key auth — use OAuth instead` };
  }

  try {
    // Both opencode and opencode-go share OPENCODE_API_KEY — set it on both.
    await modelRuntime.setRuntimeApiKey("opencode", apiKey);
    await modelRuntime.setRuntimeApiKey("opencode-go", apiKey);

    // Persist to config/auth.json so it survives server restarts.
    const auth = readAuthFile();
    auth["opencode"] = { type: "api_key", key: apiKey };
    auth["opencode-go"] = { type: "api_key", key: apiKey };
    writeAuthFile(auth);

    const authCheck = await modelRuntime.checkAuth(providerId);

    if (authCheck !== undefined) {
      return { ok: true, message: `Connected to ${providerId === "opencode" ? "OpenCode Zen" : "OpenCode Go"}` };
    }

    return { ok: false, message: "authentication failed — check your API key" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "connection failed",
    };
  }
}

export async function disconnectApiKey(providerId: string): Promise<{ ok: boolean; message: string }> {
  if (!modelRuntime) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  if (providerId !== "opencode" && providerId !== "opencode-go") {
    return { ok: false, message: `${providerId} uses OAuth — disconnect via Pi CLI /logout` };
  }

  try {
    // Clear both since they share the same key.
    await modelRuntime.removeRuntimeApiKey("opencode");
    await modelRuntime.removeRuntimeApiKey("opencode-go");

    // Persist to config/auth.json.
    const auth = readAuthFile();
    delete auth["opencode"];
    delete auth["opencode-go"];
    writeAuthFile(auth);

    return { ok: true, message: "Disconnected" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "disconnect failed",
    };
  }
}
