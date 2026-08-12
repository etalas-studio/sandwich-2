import { eq, and } from "drizzle-orm";
import { subscriptions } from "../schema.js";
import type { Database } from "../connection.js";

export interface Subscription {
  id: number;
  userId: string;
  planSlug: string;
  status: string;
  startedAt: string;
  updatedAt: string;
}

export async function createSubscription(
  db: Database,
  input: { userId: string; planSlug: string },
): Promise<Subscription> {
  const now = new Date().toISOString();
  await db.insert(subscriptions).values({
    userId: input.userId,
    planSlug: input.planSlug,
    status: "active",
    startedAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.status, "active")))
    .limit(1);
  return rows[0]!;
}

export async function getActiveSubscription(db: Database, userId: string): Promise<Subscription | null> {
  const rows = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function cancelSubscription(db: Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.update(subscriptions)
    .set({ status: "cancelled", updatedAt: now })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
}
