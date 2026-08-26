'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface ExperienceItem {
  n: string
  icon: string
  title: string
  fullTitle: string
  desc: string
  tags: string[]
}

export interface ExperiencesProps {
  kicker: string
  title: string
  desc: string
  items: ExperienceItem[]
}

export function Experiences(props: ExperiencesProps) {
  return (
    <section id="experiences" className="py-24 md:py-32 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="max-w-7xl mx-auto px-6 mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: TEXT_MUTED }}>{props.kicker}</p>
          <h2 className="text-4xl md:text-5xl tracking-tight font-medium leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>
        <p className="text-base max-w-sm" style={{ color: TEXT_MUTED }}>{props.desc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 max-w-[96rem] mx-auto border-y" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {props.items.map((item, i) => (
          <div
            key={item.n}
            className="group relative h-[400px] md:h-[600px] overflow-hidden cursor-default"
            style={{
              borderRight: i < props.items.length - 1 ? '1px solid rgba(255,255,255,0.1)' : undefined,
              borderBottom: i < props.items.length - 1 ? '1px solid rgba(255,255,255,0.1)' : undefined,
            }}
          >
            <div
              className="absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity duration-700"
              style={{ background: `radial-gradient(70% 60% at 50% 30%, ${ACCENT}22, transparent 70%)` }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 60%, #000000)' }} />

            {/* Default state */}
            <div className="absolute bottom-0 left-0 p-6 w-full transition-all duration-500 group-hover:-translate-y-4 group-hover:opacity-0">
              <span className="text-xs uppercase tracking-widest block mb-2" style={{ color: TEXT_MUTED }}>{item.n}</span>
              <h3 className="text-3xl tracking-tight font-medium" style={{ color: TEXT_PRIMARY }}>{item.title}</h3>
            </div>

            {/* Hover state */}
            <div
              className="absolute inset-0 backdrop-blur-md p-8 flex flex-col justify-end translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out"
              style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
            >
              <div className="w-full h-px mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <iconify-icon icon={item.icon} width="24" className="mb-4" style={{ color: ACCENT }} />
              <h3 className="text-2xl tracking-tight font-medium mb-4" style={{ color: TEXT_PRIMARY }}>{item.fullTitle}</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: TEXT_MUTED }}>{item.desc}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full border text-xs"
                    style={{ borderColor: 'rgba(255,255,255,0.1)', color: TEXT_MUTED, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
