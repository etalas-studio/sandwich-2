'use client'

import { HeroBackgroundVideo } from './HeroBackgroundVideo'
import { PromptPanel } from './PromptPanel'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface HeroProps {
  heroTagline: string
  navGetStarted: string
  navHow: string
  heroPromptPlaceholder: string
  heroSendLabel: string
  prompt: string
  setPrompt: (v: string) => void
  pendingType: string
  setPendingType: (v: string) => void
  isSubmitting: boolean
  error: string | null
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function Hero(props: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-40 pb-24 md:pt-56 md:pb-32">
      <HeroBackgroundVideo />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT }} />
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.heroTagline}</p>
        </div>

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
            onClick={props.onSubmit}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.35)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.navGetStarted}
          </button>
          <button
            onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 hover:bg-white/10 text-sm font-medium bg-white/5 border border-white/10 rounded-full px-8 py-3.5 backdrop-blur transition-colors"
            style={{ color: TEXT_PRIMARY }}
          >
            {props.navHow}
          </button>
        </div>

        <div className="mt-14 w-full flex justify-center">
          <PromptPanel
            prompt={props.prompt}
            setPrompt={props.setPrompt}
            pendingType={props.pendingType}
            setPendingType={props.setPendingType}
            isSubmitting={props.isSubmitting}
            error={props.error}
            onSubmit={props.onSubmit}
            onKeyDown={props.onKeyDown}
            placeholder={props.heroPromptPlaceholder}
            sendLabel={props.heroSendLabel}
          />
        </div>
      </div>
    </section>
  )
}
