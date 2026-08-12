import type Database from "better-sqlite3";
import { getCredential, upsertCredential, deleteCredential } from "../db/credentials.js";

let dbRef: Database.Database | null = null;

export function initIntegrations(db: Database.Database): void {
  dbRef = db;
}

// ────────────────────────────────────────────────────────────
// Status
// ────────────────────────────────────────────────────────────

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  authType: "api_key" | "none";
  models: Array<{ id: string; name: string }>;
  error?: string;
}

const GROQ_MODELS = [{ id: "groq/qwen/qwen3-32b", name: "Qwen3 32B (Groq)" }];

export function getIntegrationStatus(): IntegrationStatus[] {
  const results: IntegrationStatus[] = [];

  const row = getCredential(dbRef!, "groq");
  const connected = !!row;
  results.push({
    id: "groq",
    name: "Groq",
    connected,
    authType: "api_key",
    models: connected ? GROQ_MODELS : [],
    error: connected ? undefined : "API key not set",
  });

  return results;
}

// ────────────────────────────────────────────────────────────
// Connect / Disconnect
// ────────────────────────────────────────────────────────────

export async function connectWithApiKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  if (!dbRef) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  if (providerId !== "groq") {
    return { ok: false, message: `Unknown provider: ${providerId}` };
  }

  upsertCredential(dbRef, "groq", JSON.stringify({ type: "api_key", key: apiKey }));
  return { ok: true, message: "Connected to Groq" };
}

export async function disconnectApiKey(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!dbRef) {
    return { ok: false, message: "integration runtime not initialized" };
  }

  if (providerId !== "groq") {
    return { ok: false, message: `Unknown provider: ${providerId}` };
  }

  try {
    deleteCredential(dbRef, "groq");
    return { ok: true, message: "Disconnected" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "disconnect failed",
    };
  }
}
