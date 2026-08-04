import type Database from "better-sqlite3";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { getCredential, upsertCredential, deleteCredential } from "../db/credentials.js";

/**
 * Adapts the `credentials` table (src/db/credentials.ts) to Pi's
 * CredentialStore interface, so provider auth (API keys, OAuth tokens) is
 * single-sourced in the app DB instead of a separate auth.json file.
 * Row name = provider id, row value = JSON-serialized pi-ai Credential.
 */
type PiCredentials = NonNullable<Parameters<typeof ModelRuntime.create>[0]>["credentials"];

export function createDbCredentialStore(db: Database.Database): NonNullable<PiCredentials> {
  return {
    async read(providerId: string) {
      const row = getCredential(db, providerId);
      return row ? JSON.parse(row.value) : undefined;
    },
    async list() {
      const row = db.prepare("SELECT name, value FROM credentials").all() as Array<{
        name: string;
        value: string;
      }>;
      return row.map((r) => ({ providerId: r.name, type: JSON.parse(r.value).type }));
    },
    async modify(providerId: string, fn: (current: unknown) => Promise<unknown>) {
      const current = getCredential(db, providerId);
      const next = await fn(current ? JSON.parse(current.value) : undefined);
      if (next === undefined) return current ? JSON.parse(current.value) : undefined;
      upsertCredential(db, providerId, JSON.stringify(next));
      return next;
    },
    async delete(providerId: string) {
      deleteCredential(db, providerId);
    },
  } as NonNullable<PiCredentials>;
}
