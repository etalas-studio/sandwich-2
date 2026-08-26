'use client'

import { GridLines } from './GridLines'
import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface PipelineStep {
  n: string
  icon: string
  title: string
  desc: string
}

export interface PipelineProps {
  kicker: string
  title: string
  desc: string
  steps: PipelineStep[]
  ctaLabel: string
  onCtaClick: () => void
}

export function Pipeline(props: PipelineProps) {
  const [s1, s2, s3, s4] = props.steps

  return (
    <section id="pipeline" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <GridLines />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex text-[11px] ring-1 ring-white/10 font-medium bg-white/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: TEXT_MUTED }}>
            <span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="md:mt-4 mt-3 md:text-lg text-base leading-relaxed" style={{ color: TEXT_MUTED }}>{props.desc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-10">
          {/* Step 1: plain card with mini box */}
          <div className="md:p-6 overflow-hidden bg-slate-900/50 ring-white/10 ring-1 rounded-3xl pt-5 pr-5 pb-5 pl-5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-light tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>{s1?.n}</span>
              <iconify-icon icon={s1?.icon} width="20" style={{ color: ACCENT }} />
            </div>
            <h3 className="text-xl md:text-2xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{s1?.title}</h3>
            <p className="mt-2 text-sm" style={{ color: TEXT_MUTED }}>{s1?.desc}</p>
          </div>

          {/* Step 2: accent highlight card */}
          <div className="relative rounded-3xl overflow-hidden ring-1 ring-white/15 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-5 md:p-6">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 60% at 80% 0%, ${ACCENT}26, transparent 70%)` }} />
            <div className="relative flex items-center gap-3 mb-2">
              <span className="text-2xl font-light tabular-nums text-white/40">{s2?.n}</span>
              <iconify-icon icon={s2?.icon} width="20" style={{ color: ACCENT }} />
            </div>
            <h3 className="relative text-xl md:text-2xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{s2?.title}</h3>
            <p className="relative mt-2 text-sm" style={{ color: TEXT_MUTED }}>{s2?.desc}</p>
          </div>

          {/* Step 3: plain card with mini box */}
          <div className="md:p-6 overflow-hidden bg-slate-900/50 ring-white/10 ring-1 rounded-3xl pt-5 pr-5 pb-5 pl-5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-light tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>{s3?.n}</span>
              <iconify-icon icon={s3?.icon} width="20" style={{ color: ACCENT }} />
            </div>
            <h3 className="text-xl md:text-2xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{s3?.title}</h3>
            <p className="mt-2 text-sm" style={{ color: TEXT_MUTED }}>{s3?.desc}</p>
          </div>

          {/* Step 4: plain card with mini box */}
          <div className="md:p-6 overflow-hidden bg-slate-900/50 ring-white/10 ring-1 rounded-3xl pt-5 pr-5 pb-5 pl-5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-light tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>{s4?.n}</span>
              <iconify-icon icon={s4?.icon} width="20" style={{ color: ACCENT }} />
            </div>
            <h3 className="text-xl md:text-2xl font-normal tracking-tighter" style={{ color: TEXT_PRIMARY }}>{s4?.title}</h3>
            <p className="mt-2 text-sm" style={{ color: TEXT_MUTED }}>{s4?.desc}</p>
          </div>
        </div>

        <div className="flex flex-wrap mt-10 gap-x-3 gap-y-3">
          <button
            onClick={props.onCtaClick}
            className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-900 ring-1 ring-white/20 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 transition"
          >
            <span>{props.ctaLabel}</span>
            <iconify-icon icon="solar:arrow-right-linear" width="16" />
          </button>
        </div>
      </div>
    </section>
  )
}
