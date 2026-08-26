import { eq } from "drizzle-orm";
import { integrationCredentials } from "./schema.js";
import type { Database } from "./connection.js";

export interface IntegrationCredential {
  name: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getIntegrationCredential(
  db: Database,
  name: string,
): Promise<IntegrationCredential | null> {
  const rows = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.name, name))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertIntegrationCredential(
  db: Database,
  name: string,
  value: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(integrationCredentials)
    .values({ name, value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: integrationCredentials.name,
      set: { value, updatedAt: now },
    });
}

export async function deleteIntegrationCredential(
  db: Database,
  name: string,
): Promise<void> {
  await db.delete(integrationCredentials).where(eq(integrationCredentials.name, name));
}

/** Names only — never values, so a UI can list known credentials without leaking secrets. */
export async function listIntegrationCredentialNames(
  db: Database,
): Promise<string[]> {
  const rows = await db
    .select({ name: integrationCredentials.name })
    .from(integrationCredentials)
    .orderBy(integrationCredentials.name);
  return rows.map((r) => r.name);
}

function mapRow(row: typeof integrationCredentials.$inferSelect): IntegrationCredential {
  return {
    name: row.name,
    value: row.value,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
