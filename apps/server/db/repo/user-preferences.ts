import { eq, and } from "drizzle-orm";
import { userPreferences } from "../schema.js";
import type { Database } from "../connection.js";

export async function setPreference(db: Database, userId: string, key: string, value: string): Promise<void> {
  await db.insert(userPreferences).values({ userId, key, value })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.key],
      set: { value },
    });
}

export async function getPreference(db: Database, userId: string, key: string): Promise<string | null> {
  const rows = await db.select().from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
    .limit(1);
  return rows.length > 0 ? rows[0]!.value : null;
}
