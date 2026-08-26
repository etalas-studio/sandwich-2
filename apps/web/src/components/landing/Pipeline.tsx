'use client'

import { ACCENT, PANEL, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface PipelineStep {
  n: string
  icon: string
  title: string
  desc: string
}

export interface PipelineProps {
  kicker: string
  titleL1: string
  titleL2: string
  cta: string
  onCtaClick: () => void
  reveal: (id: string, extra?: string) => string
  steps: PipelineStep[]
}

export function Pipeline(props: PipelineProps) {
  return (
    <section id="pipeline" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <div id="pipeline-head" className={props.reveal('pipeline-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>
            {props.titleL1} {props.titleL2}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          {props.steps.map((step) => (
            <div key={step.n} className="relative flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center relative z-10 mb-5 border border-white/15"
                style={{ backgroundColor: PANEL, boxShadow: `0 0 20px -6px ${ACCENT}55` }}
              >
                <iconify-icon icon={step.icon} width="22" style={{ color: ACCENT }} />
              </div>
              <p className="font-medium text-base tracking-tight mb-2" style={{ color: TEXT_PRIMARY }}>{step.title}</p>
              <p className="text-sm leading-relaxed max-w-[220px]" style={{ color: TEXT_MUTED }}>{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <button
            onClick={props.onCtaClick}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.3)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.cta}
            <iconify-icon icon="solar:arrow-right-up-linear" />
          </button>
        </div>
      </div>
    </section>
  )
}
