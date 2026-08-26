'use client'

import { GridLines } from './GridLines'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

export interface HarnessesProps {
  kicker: string
  title: string
  desc: string
  linkLabel: string
  onLinkClick: () => void
}

export function Harnesses(props: HarnessesProps) {
  return (
    <section id="harnesses" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <GridLines />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <div
              className="aspect-[16/11] md:aspect-[5/4] overflow-hidden rounded-3xl relative border"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A' }}
            >
              <div className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 70% 20%, ${ACCENT}26, transparent 70%)` }} />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundSize: '40px 40px',
                  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                }}
              />
              <iconify-icon icon="solar:document-add-linear" width="72" className="absolute inset-0 m-auto opacity-20" style={{ color: TEXT_PRIMARY }} />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium ring-1 ring-white/10 w-fit" style={{ color: TEXT_SECONDARY }}>
              {props.kicker}
            </div>

            <h2 className="sm:text-5xl md:text-6xl md:font-normal md:tracking-tighter text-4xl font-semibold tracking-tight mt-4" style={{ color: TEXT_PRIMARY }}>
              {props.title}
            </h2>

            <p className="md:mt-5 md:text-lg leading-relaxed text-base mt-5" style={{ color: TEXT_MUTED }}>
              {props.desc}
            </p>

            <button onClick={props.onLinkClick} className="group inline-flex items-center gap-2 mt-6 text-sm font-medium underline decoration-white/30 underline-offset-4 hover:decoration-white/60" style={{ color: TEXT_PRIMARY }}>
              <span>{props.linkLabel}</span>
              <iconify-icon icon="solar:arrow-right-linear" width="16" className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
