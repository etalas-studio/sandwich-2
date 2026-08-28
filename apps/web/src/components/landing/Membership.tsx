'use client'

import { useRef, useState } from 'react'
import { FONT_SERIF } from './tokens'

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
  titleSans: string
  titleSerif: string
  desc: string
  bestValue: string
  plans: MembershipPlan[]
  onSelectPlan: (slug: string) => void
}

/**
 * A card that tilts in 3D toward the pointer while hovered, then eases back
 * to rest when the pointer leaves.
 */
function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('perspective(1200px) rotateX(0deg) rotateY(0deg)')
  const [smooth, setSmooth] = useState(false)

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Max tilt of ~16 degrees; stronger scale for a deeper, more playful lift.
    setSmooth(false)
    setTransform(
      `perspective(1100px) rotateX(${(-py * 16).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg) scale3d(1.06, 1.06, 1.06)`,
    )
  }

  const onMouseLeave = () => {
    setSmooth(true)
    setTransform('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{
        transform,
        transition: smooth ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 0.08s linear',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}

export function Membership(props: MembershipProps) {
  return (
    <section id="pricing" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24" style={{ backgroundColor: '#3b82f6' }}>
      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex text-[11px] ring-1 ring-white/30 font-medium bg-white/15 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: '#ffffff' }}>
            <iconify-icon icon="solar:layers-minimalistic-linear" width="14" />
            <iconify-icon icon="solar:star-shine-linear" width="13" /><span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: '#ffffff' }}>
            {props.titleSans}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
          </h2>
          <p className="md:mt-4 mt-3 md:text-lg text-base leading-relaxed" style={{ color: '#ffffff' }}>{props.desc}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto" style={{ perspective: '1200px' }}>
          {props.plans.map((plan) => (
            <TiltCard
              key={plan.slug}
              className={`relative rounded-3xl p-6 md:p-8 flex flex-col overflow-hidden ${
                plan.highlight
                  ? 'ring-1 ring-blue-300/30 bg-[radial-gradient(90%_75%_at_50%_-15%,rgba(59,130,246,0.55)_0%,rgba(37,99,235,0.30)_42%,rgba(8,15,35,0)_75%),linear-gradient(165deg,#0f2040_0%,#0a1428_48%,#060a12_100%)] shadow-[0_24px_80px_rgba(59,130,246,0.25)]'
                  : 'bg-slate-900/80 ring-1 ring-white/10'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 ring-1 ring-blue-400/40 px-2.5 py-1 text-[10px] font-medium text-blue-200">{props.bestValue}</span>
                </div>
              )}

              <div className="flex-1">
                <h3 className="text-xl font-normal tracking-tight" style={{ color: '#f1f5f9' }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-3 mb-1 flex-wrap">
                  <span className="text-4xl font-medium tracking-tighter" style={{ color: '#f1f5f9' }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: '#94a3b8' }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through ml-1" style={{ color: 'rgba(148,163,184,0.5)' }}>{plan.oldPrice}</span>}
                </div>
                <p className="mt-2 text-sm" style={{ color: 'rgba(241,245,249,0.72)' }}>{plan.desc}</p>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(241,245,249,0.72)' }}>
                      <iconify-icon icon="solar:check-circle-linear" width="20" className="text-blue-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => props.onSelectPlan(plan.slug)}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition w-full ${
                  plan.highlight
                    ? 'bg-[linear-gradient(180deg,rgba(96,165,250,0.95)_0%,rgba(59,130,246,0.85)_50%,rgba(37,99,235,0.85)_100%)] text-white ring-1 ring-blue-300/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[linear-gradient(180deg,rgba(120,180,255,1)_0%,rgba(70,140,250,0.95)_50%,rgba(45,110,245,0.95)_100%)]'
                    : 'bg-[linear-gradient(180deg,rgba(226,232,240,0.9)_0%,rgba(203,213,225,0.75)_50%,rgba(148,163,184,0.7)_100%)] text-slate-900 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-[linear-gradient(180deg,rgba(241,245,249,1)_0%,rgba(219,228,238,0.85)_50%,rgba(170,182,197,0.8)_100%)]'
                }`}
              >
                {plan.cta}
              </button>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  )
}
