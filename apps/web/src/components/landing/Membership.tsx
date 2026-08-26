'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface MembershipPlan {
  slug: string
  name: string
  price: string
  priceNote: string
  oldPrice: string | null
  desc: string
  features: string[]
  cta: string
  highlight: boolean
}

export interface MembershipProps {
  kicker: string
  titleL1: string
  titleL2: string
  desc: string
  bestValue: string
  includedLabel: string
  plans: MembershipPlan[]
  onSelectPlan: (slug: string) => void
}

export function Membership(props: MembershipProps) {
  return (
    <section id="pricing" className="py-24 md:py-32 px-6 max-w-7xl mx-auto scroll-mt-24">
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: TEXT_MUTED }}>{props.kicker}</p>
        <h2 className="text-4xl md:text-5xl tracking-tight font-medium leading-tight mb-6" style={{ color: TEXT_PRIMARY }}>
          {props.titleL1} {props.titleL2}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: TEXT_MUTED }}>{props.desc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {props.plans.map((plan) => (
          <div
            key={plan.slug}
            className="flex flex-col p-8 rounded-3xl border"
            style={{
              backgroundColor: PANEL_2,
              borderColor: plan.highlight ? `${ACCENT}55` : 'rgba(255,255,255,0.08)',
              boxShadow: plan.highlight ? `0 0 40px -20px ${ACCENT}` : undefined,
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs uppercase tracking-widest" style={{ color: TEXT_MUTED }}>{plan.name}</span>
              {plan.highlight && (
                <span
                  className="text-[10px] uppercase tracking-widest border px-3 py-1 rounded-full"
                  style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}1a`, color: ACCENT }}
                >
                  {props.bestValue}
                </span>
              )}
            </div>
            <h3 className="text-3xl tracking-tight font-medium mb-2" style={{ color: TEXT_PRIMARY }}>{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-1 flex-wrap">
              <span className="text-5xl font-medium tracking-tighter" style={{ color: TEXT_PRIMARY }}>{plan.price}</span>
              <span className="text-sm" style={{ color: TEXT_MUTED }}>{plan.priceNote}</span>
              {plan.oldPrice && <span className="text-sm line-through ml-1" style={{ color: 'rgba(237,237,237,0.3)' }}>{plan.oldPrice}</span>}
            </div>
            <p className="text-sm mb-8 flex-1 mt-3" style={{ color: TEXT_MUTED }}>{plan.desc}</p>
            <button
              onClick={() => props.onSelectPlan(plan.slug)}
              className="w-full py-3.5 rounded-full text-sm font-medium text-center transition-colors mb-8"
              style={plan.highlight
                ? { backgroundColor: '#ffffff', color: '#000000' }
                : { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_PRIMARY }}
            >
              {plan.cta}
            </button>

            <div className="space-y-4 pt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: TEXT_MUTED }}>{props.includedLabel}</p>
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <iconify-icon icon="solar:check-circle-linear" className="mt-0.5" style={{ color: TEXT_MUTED }} />
                  <span className="text-sm" style={{ color: TEXT_PRIMARY, opacity: 0.85 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
