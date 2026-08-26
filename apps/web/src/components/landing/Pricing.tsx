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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {props.plans.map((plan) => (
            <article
              key={plan.slug}
              className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-6 flex flex-col h-full transition-colors duration-300 ${
                plan.highlight
                  ? 'border-blue-500/30 bg-blue-900/10 shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
              }`}
            >
              <div className="relative flex flex-col gap-1 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>{plan.name}</h3>
                  {plan.highlight && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider text-blue-950 bg-blue-400">{props.bestValue}</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: TEXT_SECONDARY }}>{plan.desc}</p>
              </div>

              <div className="relative mb-6">
                <div className="flex items-end gap-1 flex-wrap">
                  <p className="text-3xl lg:text-4xl tracking-tighter" style={{ color: TEXT_PRIMARY }}>{plan.price}</p>
                  <span className="text-xs mb-1.5 uppercase tracking-wide" style={{ color: TEXT_MUTED }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{plan.oldPrice}</span>}
                </div>
              </div>

              <ul className="space-y-3.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <iconify-icon icon="solar:check-circle-linear" width="16" className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-sm" style={{ color: plan.highlight ? TEXT_PRIMARY : TEXT_SECONDARY }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => props.onSelectPlan(plan.slug)}
                className="w-full inline-flex items-center justify-center h-10 rounded-lg text-sm font-semibold transition"
                style={plan.highlight
                  ? { backgroundColor: ACCENT, color: '#ffffff', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }
                  : { backgroundColor: 'rgba(255,255,255,0.1)', color: TEXT_PRIMARY }}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
