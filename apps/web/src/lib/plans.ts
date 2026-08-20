import type { StringKey } from './i18n'

/**
 * Single source of truth for plan pricing + feature lists in the frontend.
 * Amounts mirror apps/server/pipeline/plans.ts (server is authoritative for
 * charging/limits; this file keeps the UI copy in one place).
 */
export interface PlanMeta {
  slug: 'starter' | 'pro'
  name: string
  price: string
  oldPrice: string | null
  amount: number
  featureKeys: StringKey[]
  descKey: StringKey
  ctaKey: StringKey
  highlight: boolean
}

export const PLANS_META: PlanMeta[] = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 'Rp 50k',
    oldPrice: null,
    amount: 50000,
    featureKeys: ['plan_starter_f2', 'plan_starter_f3', 'plan_starter_f4'],
    descKey: 'plan_starter_desc',
    ctaKey: 'plan_starter_cta',
    highlight: false,
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 'Rp 100k',
    oldPrice: 'Rp 250k',
    amount: 100000,
    featureKeys: ['plan_pro_f2', 'plan_pro_proto', 'plan_pro_f3', 'plan_pro_f4'],
    descKey: 'plan_pro_desc',
    ctaKey: 'plan_pro_cta',
    highlight: true,
  },
]

export function getPlanMeta(slug: string): PlanMeta | undefined {
  return PLANS_META.find((p) => p.slug === slug)
}
