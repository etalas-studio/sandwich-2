'use client'

import { FAQS } from '../../lib/faqs'
import { GridLines } from './GridLines'
import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './tokens'

export interface FaqProps {
  kicker: string
  title: string
  lang: 'en' | 'id'
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
}

export function Faq(props: FaqProps) {
  return (
    <section id="faq" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <GridLines />

      <div className="relative z-10 max-w-3xl mx-auto px-6 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl tracking-tight font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="rounded-2xl overflow-hidden bg-neutral-50 ring-1 ring-black/10"
              open={props.openFaq === i}
              onClick={(e) => { e.preventDefault(); props.setOpenFaq(props.openFaq === i ? null : i) }}
            >
              <summary className="w-full px-6 py-5 flex items-center justify-between text-left text-sm font-medium cursor-pointer list-none" style={{ color: LIGHT_TEXT_PRIMARY }}>
                {faq.q[props.lang]}
                <iconify-icon
                  icon="solar:add-circle-linear"
                  className={`transition-transform duration-300 shrink-0 ${props.openFaq === i ? 'rotate-45' : ''}`}
                  style={{ color: LIGHT_TEXT_MUTED }}
                />
              </summary>
              <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{faq.a[props.lang]}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
