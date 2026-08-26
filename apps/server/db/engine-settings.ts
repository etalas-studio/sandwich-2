import { eq } from "drizzle-orm";
import { engineSettings } from "./schema.js";
import type { Database } from "./connection.js";

export async function getEngineSetting(
  db: Database,
  key: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(engineSettings)
    .where(eq(engineSettings.key, key))
    .limit(1);
  return rows[0] ? rows[0].value : null;
}

export async function setEngineSetting(
  db: Database,
  key: string,
  value: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(engineSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: engineSettings.key,
      set: { value, updatedAt: now },
    });
}

export async function listEngineSettings(
  db: Database,
): Promise<Array<{ key: string; value: string }>> {
  const rows = await db
    .select({ key: engineSettings.key, value: engineSettings.value })
    .from(engineSettings)
    .orderBy(engineSettings.key);
  return rows;
}
