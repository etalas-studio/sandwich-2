'use client'

import { TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface MethodologyProps {
  kicker: string
  title: string
  desc: string
  bodyText: string
  ctaLabel: string
  onCtaClick: () => void
  cards: { n: string; title: string }[]
}

export function Methodology(props: MethodologyProps) {
  return (
    <section id="harnesses" className="py-24 md:py-32 px-6 max-w-7xl mx-auto border-b scroll-mt-24" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        <div className="lg:sticky lg:top-32">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: TEXT_MUTED }}>{props.kicker}</p>
          <h2 className="text-3xl md:text-5xl tracking-tight font-medium leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="mt-6 text-base leading-relaxed" style={{ color: TEXT_MUTED }}>{props.desc}</p>
          <div className="mt-10">
            <button
              onClick={props.onCtaClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
              {props.ctaLabel}
              <iconify-icon icon="solar:arrow-right-up-linear" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <p className="text-base leading-relaxed" style={{ color: TEXT_MUTED }}>{props.bodyText}</p>

          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <img src="/spec-illustration.webp" alt="" className="w-full h-auto block" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {props.cards.map((card) => (
              <div key={card.n} className="flex items-baseline gap-2">
                <span className="text-xs shrink-0" style={{ color: TEXT_MUTED }}>{card.n}</span>
                <span className="text-sm font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>{card.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
