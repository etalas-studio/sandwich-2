import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Database } from "../db/connection.js";
import {
  getIntegrationCredential,
  upsertIntegrationCredential,
  deleteIntegrationCredential,
  listIntegrationCredentialNames,
} from "../db/integration-credentials.js";

/**
 * Adapts the `integration_credentials` table to Pi's CredentialStore
 * interface, so provider auth (API keys) is single-sourced in the app DB
 * instead of ~/.pi/agent/auth.json. Row name = provider id, row value =
 * JSON-serialized pi-ai Credential (legacy plaintext values are read back as
 * api_key credentials).
 */
type PiCredentialStore = NonNullable<
  Parameters<typeof ModelRuntime.create>[0]
>["credentials"];

type ApiKeyCredential = { type: "api_key"; key?: string; env?: Record<string, string> };

function parseCredential(value: string): ApiKeyCredential {
  try {
    const parsed = JSON.parse(value) as { type?: string; key?: string };
    if (parsed && typeof parsed === "object") {
      return { type: "api_key", key: typeof parsed.key === "string" ? parsed.key : undefined };
    }
  } catch {
    /* fall through to legacy plaintext */
  }
  return { type: "api_key", key: value };
}

export function createDbCredentialStore(db: Database): PiCredentialStore {
  const store = {
    async read(providerId: string): Promise<ApiKeyCredential | undefined> {
      const row = await getIntegrationCredential(db, providerId);
      return row ? parseCredential(row.value) : undefined;
    },

    async list(): Promise<readonly { providerId: string; type: "api_key" }[]> {
      const names = await listIntegrationCredentialNames(db);
      return names.map((name) => ({ providerId: name, type: "api_key" as const }));
    },

    async modify(
      providerId: string,
      fn: (current: ApiKeyCredential | undefined) => Promise<ApiKeyCredential | undefined>,
    ): Promise<ApiKeyCredential | undefined> {
      const row = await getIntegrationCredential(db, providerId);
      const current = row ? parseCredential(row.value) : undefined;
      const next = await fn(current);
      if (next === undefined) return current;
      await upsertIntegrationCredential(db, providerId, JSON.stringify(next));
      return next;
    },

    async delete(providerId: string): Promise<void> {
      await deleteIntegrationCredential(db, providerId);
    },
  };

  return store as unknown as PiCredentialStore;
}
