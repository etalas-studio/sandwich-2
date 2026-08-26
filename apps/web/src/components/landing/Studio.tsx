'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface StudioProps {
  kicker: string
  title: string
  body: string
  badge: string
  cards: { n: string; title: string; desc: string }[]
  numbered: { n: string; text: string }[]
}

export function Studio(props: StudioProps) {
  return (
    <section id="differentiators" className="py-24 md:py-32 px-6 max-w-7xl mx-auto border-b scroll-mt-24" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1 flex flex-col gap-6">
          <div className="relative h-80 sm:h-96 rounded-3xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: PANEL_2 }}>
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(70% 60% at 70% 20%, ${ACCENT}2e, transparent 70%)` }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000000, transparent)' }} />
            <div
              className="absolute bottom-6 left-6 inline-flex px-3 py-1.5 rounded-full border backdrop-blur-md text-xs uppercase tracking-widest"
              style={{ borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)', color: TEXT_PRIMARY }}
            >
              {props.badge}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {props.cards.map((card) => (
              <div key={card.n} className="p-6 rounded-3xl border" style={{ backgroundColor: PANEL_2, borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="text-xs block mb-2" style={{ color: TEXT_MUTED }}>{card.n}</span>
                <h4 className="text-lg font-medium mb-2 tracking-tight" style={{ color: TEXT_PRIMARY }}>{card.title}</h4>
                <p className="text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: TEXT_MUTED }}>{props.kicker}</p>
          <h2 className="text-4xl md:text-5xl tracking-tight font-medium leading-tight mb-6" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: TEXT_MUTED }}>{props.body}</p>

          <div className="space-y-6 pt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            {props.numbered.map((item) => (
              <div key={item.n} className="flex gap-4">
                <span className="text-xs mt-1 block w-6" style={{ color: TEXT_MUTED }}>{item.n}</span>
                <p className="text-sm" style={{ color: TEXT_PRIMARY, opacity: 0.85 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
