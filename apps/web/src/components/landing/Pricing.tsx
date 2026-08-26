'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

export interface PricingPlan {
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

export interface PricingProps {
  kicker: string
  titleL1: string
  titleL2: string
  desc: string
  bestValue: string
  reveal: (id: string, extra?: string) => string
  plans: PricingPlan[]
  onSelectPlan: (slug: string) => void
}

export function Pricing(props: PricingProps) {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden border-t border-white/5 scroll-mt-24">
      <div
        className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none"
        style={{ background: `radial-gradient(600px circle at top center, ${ACCENT}14, transparent 60%)` }}
      />
      <div className="max-w-4xl mx-auto px-6 relative">
        <div id="pricing-head" className={props.reveal('pricing-head', 'mb-12 text-center')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-5xl font-light tracking-tighter mb-6 leading-tight" style={{ color: TEXT_PRIMARY }}>
            {props.titleL1}<br />{props.titleL2}
          </h2>
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {props.plans.map((plan) => (
            <div
              key={plan.slug}
              className={`flex flex-col rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform duration-300 border backdrop-blur-xl ${
                plan.highlight ? 'border-blue-500/30 bg-blue-900/10 shadow-[0_0_30px_-5px_rgba(59,130,246,0.2)]' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-lg font-medium" style={{ color: TEXT_PRIMARY }}>{plan.name}</span>
                  {plan.highlight && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full text-blue-950 bg-blue-400">{props.bestValue}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 flex-wrap mb-1">
                  <span className="font-light" style={{ fontSize: '2.5rem', lineHeight: 1, color: TEXT_PRIMARY }}>{plan.price}</span>
                  <span className="text-sm ml-1" style={{ color: TEXT_MUTED }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: 'rgba(255,255,255,0.25)' }}>{plan.oldPrice}</span>}
                </div>
                <p className="text-sm" style={{ color: TEXT_SECONDARY }}>{plan.desc}</p>
              </div>

              <div className="px-6 pb-5">
                <button
                  onClick={() => props.onSelectPlan(plan.slug)}
                  className={`w-full py-3 rounded-full text-sm font-semibold transition-all ${
                    plan.highlight ? 'shadow-[0_0_30px_rgba(59,130,246,0.3)]' : ''
                  }`}
                  style={plan.highlight ? { backgroundColor: ACCENT, color: '#ffffff' } : { backgroundColor: 'rgba(255,255,255,0.08)', color: TEXT_PRIMARY }}
                >
                  {plan.cta}
                </button>
              </div>

              <ul className="flex flex-col gap-3 px-6 py-5 flex-1 border-t border-white/10">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: TEXT_SECONDARY }}>
                    <iconify-icon icon="solar:check-circle-linear" width="15" style={{ color: ACCENT, flexShrink: 0, marginTop: '2px' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
