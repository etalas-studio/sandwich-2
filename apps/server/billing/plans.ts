import { randomBytes } from "node:crypto";

/**
 * Single source of truth for plan pricing, quota, and period length.
 * Amounts are integer IDR as required by Snap's `gross_amount`.
 * `limit` is the monthly document quota; `null` means unlimited.
 */
export interface PlanConfig {
  slug: "starter" | "pro";
  name: string;
  amount: number;
  // Monthly document quota (PRD / quotation / specs); null = unlimited.
  documentLimit: number | null;
  // Monthly prototype quota (separate — prototypes are more expensive to run); null = unlimited.
  prototypeLimit: number | null;
  // Monthly follow-up chat quota; null = unlimited.
  chatLimit: number | null;
  periodDays: number;
}

export const PLANS: Record<PlanConfig["slug"], PlanConfig> = {
  // Free tier. `amount: 0` is the signal that no Midtrans charge happens.
  starter: { slug: "starter", name: "Starter", amount: 0, documentLimit: 5, prototypeLimit: 3, chatLimit: 100, periodDays: 30 },
  pro: { slug: "pro", name: "Pro", amount: 100000, documentLimit: null, prototypeLimit: null, chatLimit: null, periodDays: 30 },
};

export function getPlan(slug: string): PlanConfig | undefined {
  return slug === "starter" || slug === "pro" ? PLANS[slug] : undefined;
}

/**
 * Midtrans requires `order_id` to be unique per transaction attempt and
 * limited to a safe charset. We keep it opaque — the `order_id → user`
 * mapping lives in the `payments` table, not in the id itself.
 */
export function generateOrderId(planSlug: string, userId: string): string {
  const suffix = randomBytes(3).toString("hex");
  return `${planSlug}-${userId.slice(0, 8)}-${Date.now()}-${suffix}`;
}
