import { eq, and } from "drizzle-orm";
import { usage } from "../schema.js";
import type { Database } from "../connection.js";

export async function incrementUsage(db: Database, userId: string): Promise<number> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${now.getMonth()}`;

  const existing = await db.select().from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    const newCount = existing[0]!.count + 1;
    await db.update(usage)
      .set({ count: newCount })
      .where(eq(usage.id, existing[0]!.id));
    return newCount;
  }

  await db.insert(usage).values({ userId, yearMonth, count: 1 });
  return 1;
}

export async function getMonthlyUsage(db: Database, userId: string): Promise<number> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const rows = await db.select().from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.yearMonth, yearMonth)))
    .limit(1);
  return rows.length > 0 ? rows[0]!.count : 0;
}
