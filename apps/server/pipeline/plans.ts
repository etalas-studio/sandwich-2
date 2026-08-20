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
  // Monthly generated PRD quota; null = unlimited.
  documentLimit: number | null;
  // Kept in the API shape for backwards compatibility. Prototypes are not
  // quota-limited by the current product rules.
  prototypeLimit: number | null;
  // Monthly follow-up chat quota; null = unlimited.
  chatLimit: number | null;
  periodDays: number;
}

export const PLANS: Record<PlanConfig["slug"], PlanConfig> = {
  starter: { slug: "starter", name: "Starter", amount: 50000, documentLimit: 5, prototypeLimit: null, chatLimit: 100, periodDays: 30 },
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
