import type { SubscriptionRepository } from "../ports/index.js";
import type { PaymentRepository } from "../ports/index.js";
import type { UsageRepository } from "../ports/index.js";
import { PLANS } from "../../domain/billing/index.js";

/** Returns the user's current plan config. Defaults to starter if no subscription found. */
export async function getUserPlan(
  repos: { subscriptions: SubscriptionRepository },
  userId: string,
): Promise<{ planSlug: string; config: (typeof PLANS)[keyof typeof PLANS] }> {
  const sub = await repos.subscriptions.findActiveByUserId(userId);
  const planSlug = (sub?.planSlug ?? "starter") as keyof typeof PLANS;
  const config = PLANS[planSlug] ?? PLANS.starter;
  return { planSlug, config };
}

/** Returns the user's monthly usage counts by kind for the current period. */
export async function getUserUsage(
  repos: { usage: UsageRepository },
  userId: string,
): Promise<Record<string, number>> {
  const [doc, prototype, chat] = await Promise.all([
    repos.usage.getMonthly(userId, "doc"),
    repos.usage.getMonthly(userId, "prototype"),
    repos.usage.getMonthly(userId, "chat"),
  ]);
  return { doc, prototype, chat };
}

/** Returns true if the user can create another document of the given type. */
export async function checkDocumentQuota(
  repos: { subscriptions: SubscriptionRepository; usage: UsageRepository },
  userId: string,
  documentType: "doc" | "prototype" | "chat",
): Promise<boolean> {
  const { config } = await getUserPlan(repos, userId);

  let limit: number | null;
  if (documentType === "doc") {
    limit = config.documentLimit;
  } else if (documentType === "prototype") {
    limit = config.prototypeLimit;
  } else {
    limit = config.chatLimit;
  }

  // null = unlimited
  if (limit === null) return true;

  const used = await repos.usage.getMonthly(userId, documentType);
  return used < limit;
}

/** Expires stale pending payments — call on startup or via cron. */
export async function expireStalePayments(
  repos: { payments: PaymentRepository },
): Promise<void> {
  await repos.payments.expireStale();
}
