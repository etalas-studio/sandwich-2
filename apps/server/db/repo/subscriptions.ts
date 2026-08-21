import { and, eq, gt, isNull, or } from "drizzle-orm";
import { subscriptions } from "../schema.js";
import type { Database } from "../connection.js";
import { PLANS } from "../../pipeline/plans.js";

export interface Subscription {
  id: string;
  userId: string;
  planSlug: string;
  status: string;
  periodDays: number;
  expiresAt: Date | null;
  startedAt: Date;
  updatedAt: Date;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function getSubscriptionForUser(
  db: Database,
  userId: string,
): Promise<Subscription | null> {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return rows[0] ?? null;
}

/**
 * An active subscription must be `active` AND not yet expired. Expiry is
 * enforced here (no grace period per product decision).
 */
export async function getActiveSubscription(
  db: Database,
  userId: string,
): Promise<Subscription | null> {
  const rows = await db.select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        or(
          isNull(subscriptions.expiresAt),
          gt(subscriptions.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Activate or extend a plan. Called from the verified payment webhook, the
 * dev simulation path, and at registration (free Starter). Never from raw
 * client input.
 *
 * Free plans never expire (permanent free tier). Paid renewal extends from
 * `max(now, existing.expiresAt)` so an active plan stacks, while an expired
 * plan restarts from now.
 */
export async function activateSubscription(
  db: Database,
  input: { userId: string; planSlug: string },
): Promise<Subscription> {
  const plan = PLANS[input.planSlug as keyof typeof PLANS] ?? PLANS.starter;
  const now = new Date();
  const existing = await getSubscriptionForUser(db, input.userId);

  const isFree = plan.amount === 0;
  const expiresAt = isFree
    ? null
    : addDays(
        existing?.expiresAt && existing.expiresAt.getTime() > now.getTime()
          ? existing.expiresAt
          : now,
        plan.periodDays,
      );

  if (existing) {
    await db.update(subscriptions).set({
      planSlug: input.planSlug,
      status: "active",
      periodDays: plan.periodDays,
      expiresAt,
      updatedAt: now,
    }).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      userId: input.userId,
      planSlug: input.planSlug,
      status: "active",
      periodDays: plan.periodDays,
      expiresAt,
      startedAt: now,
      updatedAt: now,
    });
  }

  return (await getSubscriptionForUser(db, input.userId))!;
}

/**
 * Revoke access (e.g. after a full refund). Cancelled subscriptions are not
 * returned by getActiveSubscription, so the user is immediately gated out.
 */
export async function cancelSubscription(db: Database, userId: string): Promise<void> {
  await db.update(subscriptions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
}

export async function deleteSubscriptionByUser(db: Database, userId: string): Promise<void> {
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
}
