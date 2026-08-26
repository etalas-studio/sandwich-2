'use client'

import { GridLines } from './GridLines'
import { TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface ClosingCtaProps {
  kicker: string
  title: string
  desc: string
  ctaPrimary: string
  ctaSecondary: string
  onPrimaryClick: () => void
  onSecondaryClick: () => void
  bullets: string[]
}

export function ClosingCta(props: ClosingCtaProps) {
  return (
    <section id="start" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20">
      <GridLines />

      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 ring-1 ring-white/10 backdrop-blur-md">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
          </div>

          <div className="relative px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium ring-1 ring-white/10 mb-6" style={{ color: TEXT_MUTED }}>
                <iconify-icon icon="solar:rocket-linear" width="16" />
                <span>{props.kicker}</span>
              </div>

              <h2 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: TEXT_MUTED }}>{props.desc}</p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={props.onPrimaryClick}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-neutral-900 ring-1 ring-white/20 px-6 py-3 text-base font-medium hover:bg-neutral-100 transition"
                >
                  <span>{props.ctaPrimary}</span>
                  <iconify-icon icon="solar:arrow-right-linear" width="20" />
                </button>
                <button
                  onClick={props.onSecondaryClick}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 text-white ring-1 ring-white/15 px-6 py-3 text-base font-medium hover:bg-white/15 transition"
                >
                  <span>{props.ctaSecondary}</span>
                  <iconify-icon icon="solar:calendar-linear" width="20" />
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: TEXT_MUTED }}>
                {props.bullets.map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <iconify-icon icon="solar:check-circle-linear" width="16" className="text-blue-300" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
