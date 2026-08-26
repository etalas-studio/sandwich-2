'use client'

import { PromptPanel, type PromptPanelProps } from './PromptPanel'
import { TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FinalCtaProps extends PromptPanelProps {
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
}

export function FinalCta(props: FinalCtaProps) {
  return (
    <section className="relative overflow-hidden py-24 border-t border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 max-w-2xl mx-auto px-6">
        <div id="final-cta-head" className={props.reveal('final-cta-head', 'text-center mb-10')}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="mt-4 text-base" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <div className="flex justify-center">
          <PromptPanel
            prompt={props.prompt}
            setPrompt={props.setPrompt}
            pendingType={props.pendingType}
            setPendingType={props.setPendingType}
            isSubmitting={props.isSubmitting}
            error={props.error}
            onSubmit={props.onSubmit}
            onKeyDown={props.onKeyDown}
            placeholder={props.placeholder}
            sendLabel={props.sendLabel}
          />
        </div>
      </div>
    </section>
  )
}
