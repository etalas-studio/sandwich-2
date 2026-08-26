'use client'

import { ACCENT, PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface DifferentiatorItem {
  icon: string
  title: string
  desc: string
  highlight: boolean
}

export interface DifferentiatorsProps {
  kicker: string
  title: string
  reveal: (id: string, extra?: string) => string
  items: DifferentiatorItem[]
}

export function Differentiators(props: DifferentiatorsProps) {
  return (
    <section id="differentiators" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <div id="diff-head" className={props.reveal('diff-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-3xl md:text-5xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {props.items.map((d) => (
            <div
              key={d.title}
              className={`p-8 min-h-[240px] rounded-2xl border flex flex-col justify-between transition-colors duration-300 ${
                d.highlight ? 'border-blue-500/30 bg-blue-900/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]' : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
              }`}
              style={!d.highlight ? { backgroundColor: PANEL } : undefined}
            >
              <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: d.highlight ? `${ACCENT}26` : 'rgba(255,255,255,0.05)' }}>
                <iconify-icon icon={d.icon} width="24" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="font-medium text-lg tracking-tight mb-2" style={{ color: TEXT_PRIMARY }}>{d.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
