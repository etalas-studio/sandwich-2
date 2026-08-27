import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Database } from "../db/connection.js";
import { createDbCredentialStore } from "./db-credential-store.js";
import {
  getIntegrationCredential,
  upsertIntegrationCredential,
  deleteIntegrationCredential,
} from "../db/integration-credentials.js";

/**
 * Pi SDK integration layer.
 *
 * opencode-go is BUILT-IN (OpenCode Go API key via OPENCODE_API_KEY env or the
 * DB credential store). 9router is registered programmatically here as an
 * openai-completions provider whose model list is fetched from its /v1/models
 * endpoint (with a hardcoded Claude fallback for resilience).
 *
 * Credentials are single-sourced in `integration_credentials` (see
 * db-credential-store.ts) — no auth.json file.
 */

export type PiRuntime = Awaited<ReturnType<typeof ModelRuntime.create>>;

let runtime: PiRuntime | null = null;
let dbRef: Database | null = null;

// ── 9router ──────────────────────────────────────────────────────────────────

const NINEROUTER_PROVIDER_ID = "9router";
const NINEROUTER_BASE_URL_CREDENTIAL = "9router:baseUrl";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

interface NineRouterModelDef {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: typeof ZERO_COST;
  contextWindow: number;
  maxTokens: number;
}

/** Curated Claude fallback — mirrors what /v1/models returns for the Claude subscription. */
const FALLBACK_9ROUTER_MODELS: NineRouterModelDef[] = [
  { id: "cc/claude-opus-5", name: "Claude Opus 5", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 1_000_000, maxTokens: 128_000 },
  { id: "cc/claude-fable-5", name: "Claude Fable 5", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 1_000_000, maxTokens: 128_000 },
  { id: "cc/claude-sonnet-5", name: "Claude Sonnet 5", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 1_000_000, maxTokens: 128_000 },
  { id: "cc/claude-sonnet-4-6", name: "Claude Sonnet 4.6", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 1_000_000, maxTokens: 128_000 },
  { id: "cc/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 200_000, maxTokens: 64_000 },
];

interface NineRouterModelsResponse {
  data?: Array<{
    id: string;
    capabilities?: {
      vision?: boolean;
      tools?: boolean;
      reasoning?: boolean;
      contextWindow?: number;
      maxOutput?: number;
    };
    context_length?: number;
    max_completion_tokens?: number;
  }>;
}

async function fetch9RouterModels(
  baseUrl: string,
  apiKey: string,
): Promise<NineRouterModelDef[]> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return FALLBACK_9ROUTER_MODELS;
    const json = (await res.json()) as NineRouterModelsResponse;
    const models = (json.data ?? [])
      // The account only holds a Claude subscription — cc/* is the usable family.
      .filter((m) => m.id.startsWith("cc/"))
      .map<NineRouterModelDef>((m) => ({
        id: m.id,
        name: m.id,
        reasoning: false,
        input: m.capabilities?.vision ? ["text", "image"] : ["text"],
        cost: ZERO_COST,
        contextWindow:
          m.capabilities?.contextWindow ?? m.context_length ?? 200_000,
        maxTokens: m.capabilities?.maxOutput ?? m.max_completion_tokens ?? 8_192,
      }));
    return models.length > 0 ? models : FALLBACK_9ROUTER_MODELS;
  } catch {
    return FALLBACK_9ROUTER_MODELS;
  }
}

export async function getNineRouterBaseUrl(db: Database): Promise<string | null> {
  const stored = await getIntegrationCredential(db, NINEROUTER_BASE_URL_CREDENTIAL);
  if (stored) return stored.value;
  const env = process.env.NINEROUTER_URL?.replace(/\/+$/, "");
  if (env) return env.endsWith("/v1") ? env : `${env}/v1`;
  return null;
}

async function getProviderApiKey(providerId: string): Promise<string> {
  if (!dbRef) return "";
  const cred = await getIntegrationCredential(dbRef, providerId);
  if (!cred) return "";
  try {
    const parsed = JSON.parse(cred.value) as { key?: string };
    return parsed.key ?? "";
  } catch {
    return cred.value;
  }
}

async function getNineRouterApiKey(): Promise<string> {
  const stored = await getProviderApiKey(NINEROUTER_PROVIDER_ID);
  if (stored) return stored;
  return process.env.NINEROUTER_KEY ?? "";
}

async function registerNineRouterProvider(
  rt: PiRuntime,
  db: Database,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  const models = await fetch9RouterModels(baseUrl, apiKey);
  rt.registerProvider(NINEROUTER_PROVIDER_ID, {
    name: "9Router",
    baseUrl,
    apiKey,
    api: "openai-completions",
    models,
  } as any);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export async function initIntegrations(db: Database): Promise<void> {
  dbRef = db;
  runtime = await ModelRuntime.create({
    credentials: createDbCredentialStore(db),
    modelsPath: null,
  });

  const baseUrl = await getNineRouterBaseUrl(db);
  const apiKey = await getNineRouterApiKey();
  if (baseUrl && apiKey) {
    await registerNineRouterProvider(runtime, db, apiKey, baseUrl);
    console.log(`[integrations] 9router registered: ${baseUrl}`);
  } else if (baseUrl) {
    console.warn("[integrations] 9router base URL set but no API key — provider not registered");
  }
}

export async function getModelRuntime(): Promise<PiRuntime> {
  if (!runtime) {
    // Defensive path (e.g. tests or a caller that skipped initIntegrations):
    // build a bare runtime without DB credentials; built-in providers still work.
    runtime = await ModelRuntime.create({ modelsPath: null });
  }
  return runtime;
}

export function getDbRef(): Database | null {
  return dbRef;
}

// ── Status / connect / test / disconnect (admin panel) ───────────────────────

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  authType: "api_key" | "none";
  models: Array<{ id: string; name: string }>;
  error?: string;
  baseUrl?: string;
  // The stored API key, reflected back to the admin panel so an operator can
  // see/rotate it. This endpoint is admin-only (requireAdmin); the value is
  // undefined when the provider is not connected.
  apiKey?: string;
}

const PROVIDER_META: Record<string, { name: string }> = {
  "opencode-go": { name: "OpenCode Go" },
  "9router": { name: "9Router" },
};

const ENGINE_PROVIDER_IDS = ["opencode-go", "9router"] as const;

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const rt = await getModelRuntime();
  const results: IntegrationStatus[] = [];

  for (const providerId of ENGINE_PROVIDER_IDS) {
    const meta = PROVIDER_META[providerId]!;
    try {
      const authCheck = await rt.checkAuth(providerId);
      const connected = authCheck !== undefined;
      const models = connected
        ? rt
            .getModels(providerId)
            .map((m) => ({ id: `${m.provider}/${m.id}`, name: m.name }))
        : [];
      results.push({
        id: providerId,
        name: meta.name,
        connected,
        authType: "api_key",
        models,
        error: connected ? undefined : "API key not set",
        apiKey:
          connected && dbRef ? ((await getProviderApiKey(providerId)) || undefined) : undefined,
        baseUrl:
          providerId === "9router" && dbRef
            ? (await getNineRouterBaseUrl(dbRef)) ?? undefined
            : undefined,
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

export async function connectWithApiKey(
  providerId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; message: string }> {
  const rt = await getModelRuntime();
  if (!dbRef) return { ok: false, message: "integration runtime not initialized" };
  if (!ENGINE_PROVIDER_IDS.includes(providerId as (typeof ENGINE_PROVIDER_IDS)[number])) {
    return { ok: false, message: `${providerId} does not support API key auth` };
  }

  if (providerId === "9router" && baseUrl && baseUrl.trim()) {
    upsertIntegrationCredential(dbRef, NINEROUTER_BASE_URL_CREDENTIAL, baseUrl.trim());
  }

  upsertIntegrationCredential(dbRef, providerId, JSON.stringify({ type: "api_key", key: apiKey }));

  if (providerId === "9router") {
    const resolvedBaseUrl =
      baseUrl?.trim() ||
      (await getNineRouterBaseUrl(dbRef)) ||
      process.env.NINEROUTER_URL ||
      "";
    await registerNineRouterProvider(rt, dbRef, apiKey, resolvedBaseUrl);
  }

  const authCheck = await rt.checkAuth(providerId);
  if (authCheck !== undefined) {
    return { ok: true, message: `Connected to ${PROVIDER_META[providerId]!.name}` };
  }

  deleteIntegrationCredential(dbRef, providerId);
  if (providerId === "9router") rt.unregisterProvider(NINEROUTER_PROVIDER_ID);
  return { ok: false, message: "authentication failed — check your API key" };
}

/** Test a connection without persisting anything. */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; message: string }> {
  const rt = await getModelRuntime();
  if (!dbRef) return { ok: false, message: "integration runtime not initialized" };
  if (!ENGINE_PROVIDER_IDS.includes(providerId as (typeof ENGINE_PROVIDER_IDS)[number])) {
    return { ok: false, message: `${providerId} does not support connection testing` };
  }

  if (providerId === "9router") {
    const resolvedBaseUrl =
      baseUrl?.trim() ||
      (await getNineRouterBaseUrl(dbRef)) ||
      process.env.NINEROUTER_URL ||
      "";
    await registerNineRouterProvider(rt, dbRef, apiKey, resolvedBaseUrl);
  }

  try {
    const model = rt.getModels(providerId)[0];
    if (!model) return { ok: false, message: "no models registered for this provider" };
    const message = await rt.completeSimple(
      model,
      { messages: [{ role: "user", content: "Reply with exactly: OK", timestamp: Date.now() }] },
      { apiKey, signal: AbortSignal.timeout(15_000) },
    );
    if (message.stopReason === "error" || message.stopReason === "aborted") {
      return { ok: false, message: message.errorMessage ?? `stream ${message.stopReason}` };
    }
    return { ok: true, message: `Connected — ${model.id} responded` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "connection failed" };
  }
}

export async function disconnectApiKey(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  const rt = await getModelRuntime();
  if (!dbRef) return { ok: false, message: "integration runtime not initialized" };
  if (!ENGINE_PROVIDER_IDS.includes(providerId as (typeof ENGINE_PROVIDER_IDS)[number])) {
    return { ok: false, message: `${providerId} is not an engine provider` };
  }

  deleteIntegrationCredential(dbRef, providerId);
  if (providerId === "9router") rt.unregisterProvider(NINEROUTER_PROVIDER_ID);
  return { ok: true, message: "Disconnected" };
}

/** Test a stored connection using the credential from the DB. */
export async function pingStoredProvider(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!dbRef) return { ok: false, message: "integration runtime not initialized" };
  const cred = await getIntegrationCredential(dbRef, providerId);
  if (!cred) return { ok: false, message: `${providerId} is not connected` };
  let apiKey: string;
  try {
    const parsed = JSON.parse(cred.value) as { key?: string };
    apiKey = parsed.key ?? "";
  } catch {
    apiKey = cred.value;
  }
  if (!apiKey) return { ok: false, message: "no API key stored" };
  return testProviderConnection(providerId, apiKey);
}
