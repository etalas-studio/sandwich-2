'use client'

import { FONT_SERIF } from './tokens'

export interface ClosingCtaProps {
  kicker: string
  titleSans: string
  titleSerif: string
  desc: string
  ctaPrimary: string
  onPrimaryClick: () => void
}

export function ClosingCta(props: ClosingCtaProps) {
  return (
    <section id="start" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20">
      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div id="start-card" className="relative overflow-hidden rounded-3xl ring-1 ring-black/10">
          {/* Grass background image with a dark scrim for text legibility */}
          <img
            src="/hero-grass.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />

          <div className="relative px-6 py-16 md:px-12 md:py-20 lg:px-16 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15 mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <iconify-icon icon="solar:rocket-linear" width="16" />
                <span>{props.kicker}</span>
              </div>

              <h2 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tighter" style={{ color: '#ffffff' }}>
                {props.titleSans}{' '}
                <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{props.desc}</p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={props.onPrimaryClick}
                  className="inline-flex items-center justify-center gap-2 rounded-full text-white ring-1 ring-blue-500/40 px-6 py-3 text-base font-medium hover:opacity-90 transition"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  <span>{props.ctaPrimary}</span>
                  <iconify-icon icon="solar:arrow-right-linear" width="20" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
