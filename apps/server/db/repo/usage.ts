import { eq, and } from "drizzle-orm";
import { usage } from "../schema.js";
import type { Database } from "../connection.js";

/** "doc" = PRD/quotation/specs (text deliverables), "prototype" = prototype engine, "chat" = follow-up messages. */
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

  const existing = await db.select().from(usage)
    .where(and(
      eq(usage.userId, userId),
      eq(usage.yearMonth, yearMonth),
      eq(usage.kind, kind),
    ))
    .limit(1);

  if (existing.length > 0) {
    const newCount = existing[0]!.count + 1;
    await db.update(usage)
      .set({ count: newCount })
      .where(eq(usage.id, existing[0]!.id));
    return newCount;
  }

  await db.insert(usage).values({ userId, yearMonth, kind, count: 1 });
  return 1;
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
