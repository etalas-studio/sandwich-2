'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface HeroProps {
  heroTagline: string
  navGetStarted: string
  navHow: string
  onGetStartedClick: () => void
  onHowClick: () => void
}

export function Hero(props: HeroProps) {
  return (
    <section className="relative z-10 pt-40 pb-24 md:pt-56 md:pb-32 text-center">
      <div className="max-w-4xl mx-auto px-6 flex flex-col items-center">
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl leading-[1.05] font-light tracking-tighter"
          style={{ color: TEXT_PRIMARY }}
        >
          SANDWICH
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mt-6 font-light" style={{ color: TEXT_SECONDARY }}>
          {props.heroTagline}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={props.onGetStartedClick}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.35)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.navGetStarted}
          </button>
          <button
            onClick={props.onHowClick}
            className="inline-flex items-center gap-2 hover:bg-black/[0.06] text-sm font-medium bg-black/[0.03] border border-black/10 rounded-full px-8 py-3.5 backdrop-blur transition-colors"
            style={{ color: TEXT_PRIMARY }}
          >
            {props.navHow}
          </button>
        </div>
      </div>
    </section>
  )
}
