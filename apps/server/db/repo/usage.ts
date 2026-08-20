import { eq, and, sql } from "drizzle-orm";
import { usage } from "../schema.js";
import type { Database } from "../connection.js";

/** "doc" = generated PRDs, "prototype" = legacy analytics, "chat" = follow-up messages. */
export type UsageKind = "doc" | "prototype" | "chat";

/** "YYYY-MM" (1-indexed, zero-padded month) — stable sortable key. */
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function incrementUsage(
  db: Database,
  userId: string,
  kind: UsageKind,
): Promise<number> {
  const yearMonth = currentYearMonth();
  // Atomic upsert — prevents race condition where concurrent requests both
  // read below-limit and both proceed past quota.
  const rows = await db
    .insert(usage)
    .values({ userId, yearMonth, kind, count: 1 })
    .onConflictDoUpdate({
      target: [usage.userId, usage.yearMonth, usage.kind],
      set: { count: sql`${usage.count} + 1` },
    })
    .returning({ count: usage.count });
  return rows[0]!.count;
}

export async function getMonthlyUsage(
  db: Database,
  userId: string,
  kind: UsageKind,
): Promise<number> {
  const yearMonth = currentYearMonth();
  const rows = await db.select().from(usage)
    .where(and(
      eq(usage.userId, userId),
      eq(usage.yearMonth, yearMonth),
      eq(usage.kind, kind),
    ))
    .limit(1);
  return rows.length > 0 ? rows[0]!.count : 0;
}
