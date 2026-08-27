'use client'

import { GridLines } from './GridLines'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, LIGHT_TEXT_SECONDARY } from './tokens'

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
  title: string
  desc: string
  bestValue: string
  plans: MembershipPlan[]
  onSelectPlan: (slug: string) => void
}

export function Membership(props: MembershipProps) {
  return (
    <section id="pricing" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <GridLines />
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(45% 55% at 50% 0%, ${ACCENT}14, transparent 70%)` }} />

      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <iconify-icon icon="solar:layers-minimalistic-linear" width="14" />
            <span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY }}>{props.title}</h2>
          <p className="md:mt-4 mt-3 md:text-lg text-base leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{props.desc}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto">
          {props.plans.map((plan) => (
            <div
              key={plan.slug}
              className={`relative rounded-3xl backdrop-blur-md p-6 md:p-8 flex flex-col overflow-hidden ${
                plan.highlight ? 'ring-2 ring-blue-500/40 bg-gradient-to-b from-blue-50 to-white' : 'bg-neutral-50 ring-1 ring-black/10'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 ring-1 ring-blue-500/30 px-2.5 py-1 text-[10px] font-medium text-blue-700">{props.bestValue}</span>
                </div>
              )}

              <div className="flex-1">
                <h3 className="text-xl font-normal tracking-tight" style={{ color: LIGHT_TEXT_PRIMARY }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-3 mb-1 flex-wrap">
                  <span className="text-4xl font-medium tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: LIGHT_TEXT_MUTED }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through ml-1" style={{ color: 'rgba(10,10,10,0.35)' }}>{plan.oldPrice}</span>}
                </div>
                <p className="mt-2 text-sm" style={{ color: LIGHT_TEXT_SECONDARY }}>{plan.desc}</p>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: plan.highlight ? LIGHT_TEXT_SECONDARY : LIGHT_TEXT_MUTED }}>
                      <iconify-icon icon="solar:check-circle-linear" width="20" className="text-blue-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => props.onSelectPlan(plan.slug)}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition w-full ${
                  plan.highlight ? 'bg-neutral-900 text-white ring-1 ring-black/10 hover:bg-neutral-800' : 'bg-black/5 text-neutral-900 ring-1 ring-black/10 hover:bg-black/10'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
