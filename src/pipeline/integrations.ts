import type Database from "better-sqlite3";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { createDbCredentialStore } from "./db-credential-store.js";
import { upsertCredential, deleteCredential } from "../db/credentials.js";
import { isOAuthConnected, disconnectOAuth } from "./oauth-integrations.js";

/**
 * Pi SDK integration layer.
 *
 * OpenCode Go ("opencode-go"), Anthropic ("anthropic"), and OpenAI Codex ("openai-codex") are BUILT-IN
 * providers in Pi.  No models.json required — ModelRuntime.create() picks
 * them up automatically from the shipped provider catalog.
 *
 * - opencode-go:   API key auth (OPENCODE_API_KEY env var or runtime key).
 * - anthropic:     API key auth (ANTHROPIC_API_KEY env var or runtime key).
 * - openai-codex:  OAuth-only (ChatGPT Plus/Pro subscription via /login).
 *
 * Credentials are single-sourced in the app DB's `credentials` table (see
 * db-credential-store.ts) — no auth.json file, project-local or otherwise.
 */

let modelRuntime: Awaited<ReturnType<typeof ModelRuntime.create>> | null = null;
let dbRef: Database.Database | null = null;

export function getModelRuntime(): Awaited<ReturnType<typeof ModelRuntime.create>> | null {
  return modelRuntime;
}

export async function initIntegrations(db: Database.Database): Promise<void> {
  dbRef = db;
  modelRuntime = await ModelRuntime.create({
    credentials: createDbCredentialStore(db),
    modelsPath: null,
  });
  const providerIds = modelRuntime.getProviders().map((p) => p.id);
  console.log(`Integrations: loaded ${providerIds.length} providers (${providerIds.join(", ")})`);
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

// Display name only — model lists come from Pi's live provider catalog
// (modelRuntime.getModels), never hardcoded here.
const PROVIDER_META: Record<string, { name: string }> = {
  "opencode-go": { name: "OpenCode Go" },
  "anthropic": { name: "Claude (Anthropic)" },
  "openai-codex": { name: "OpenAI Codex" },
  "jira": { name: "Jira" },
  "bitbucket": { name: "Bitbucket" },
  "github": { name: "GitHub" },
};

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const results: IntegrationStatus[] = [];

  // ── Pi SDK providers ──
  if (modelRuntime) {
    for (const providerId of ["opencode-go", "anthropic", "openai-codex"]) {
      const meta = PROVIDER_META[providerId]!;
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
  } else {
    results.push(
      { id: "opencode-go", name: "OpenCode Go", connected: false, authType: "none", models: [], error: "runtime not initialized" },
      { id: "anthropic", name: "Claude (Anthropic)", connected: false, authType: "none", models: [], error: "runtime not initialized" },
      { id: "openai-codex", name: "OpenAI Codex", connected: false, authType: "none", models: [], error: "runtime not initialized" },
    );
  }

  // ── OAuth providers (Jira / Bitbucket / GitHub) ──
  for (const providerId of ["jira", "bitbucket", "github"]) {
    const meta = PROVIDER_META[providerId]!;
    const connected = isOAuthConnected(providerId);
    results.push({
      id: providerId,
      name: meta.name,
      connected,
      authType: "oauth",
      models: [],
      error: connected ? undefined : "Not connected",
    });
  }

  // ── 9Router (disabled for now) ──
  results.push({
    id: "9router",
    name: "9Router",
    connected: false,
    authType: "none",
    models: [],
    error: "Coming soon",
  });

  return results;
}

// ────────────────────────────────────────────────────────────
// Connect / Disconnect — writes go straight through the DB-backed
// CredentialStore (db-credential-store.ts, same `credentials` table);
// ModelRuntime.checkAuth() reads the store live, no separate cache to sync.
// ────────────────────────────────────────────────────────────

export async function connectWithApiKey(providerId: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (!modelRuntime || !dbRef) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  // OAuth providers — handled by the authorize redirect
  if (providerId === "jira" || providerId === "bitbucket" || providerId === "github") {
    return { ok: true, message: "Use OAuth authorize endpoint: /api/integrations/${providerId}/authorize" };
  }

  if (providerId !== "opencode-go" && providerId !== "anthropic") {
    return { ok: false, message: `${providerId} does not support API key auth — use OAuth instead` };
  }

  try {
    upsertCredential(dbRef, providerId, JSON.stringify({ type: "api_key", key: apiKey }));

    const authCheck = await modelRuntime.checkAuth(providerId);

    if (authCheck !== undefined) {
      const providerName = providerId === "opencode-go" ? "OpenCode Go" : "Claude (Anthropic)";
      return { ok: true, message: `Connected to ${providerName}` };
    }

    deleteCredential(dbRef, providerId);
    return { ok: false, message: "authentication failed — check your API key" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "connection failed",
    };
  }
}

export async function disconnectApiKey(providerId: string): Promise<{ ok: boolean; message: string }> {
  if (!dbRef) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  if (providerId === "jira" || providerId === "bitbucket" || providerId === "github") {
    disconnectOAuth(providerId);
    return { ok: true, message: "Disconnected" };
  }

  if (providerId !== "opencode-go" && providerId !== "anthropic") {
    return { ok: false, message: `${providerId} uses OAuth — disconnect via Pi CLI /logout` };
  }

  try {
    deleteCredential(dbRef, providerId);
    return { ok: true, message: "Disconnected" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "disconnect failed",
    };
  }
}
