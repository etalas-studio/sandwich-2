'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface HarnessesProps {
  kicker: string
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
}

export function Harnesses(props: HarnessesProps) {
  return (
    <section id="harnesses" className="py-24 md:py-32 relative overflow-hidden border-t border-white/5 bg-white/[0.02] scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 relative">
        <div id="harnesses-head" className={props.reveal('harnesses-head', 'text-center mb-10')}>
          <p className="text-xs font-semibold tracking-wider uppercase font-mono" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-neutral-900/40 p-8 sm:p-12">
          <iconify-icon icon="solar:quote-left-bold" width="32" className="absolute top-6 left-6 opacity-20" style={{ color: TEXT_PRIMARY }} />
          <p className="relative text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: TEXT_SECONDARY }}>
            {props.desc}
          </p>
        </div>
      </div>
    </section>
  )
}
