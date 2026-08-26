'use client'

import { FAQS } from '../../lib/faqs'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FaqProps {
  kicker: string
  title: string
  cta: string
  onCtaClick: () => void
  reveal: (id: string, extra?: string) => string
  lang: 'en' | 'id'
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
}

export function Faq(props: FaqProps) {
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-black/5 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-6">
        <div id="faq-head" className={props.reveal('faq-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="flex flex-col divide-y divide-black/10">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group py-6"
              open={props.openFaq === i}
              onClick={(e) => { e.preventDefault(); props.setOpenFaq(props.openFaq === i ? null : i) }}
            >
              <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                <span className="text-base font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>{faq.q[props.lang]}</span>
                <iconify-icon
                  icon="solar:alt-arrow-down-linear"
                  className={`text-xl shrink-0 transition-transform duration-300 ${props.openFaq === i ? 'rotate-180' : ''}`}
                  style={{ color: ACCENT }}
                />
              </summary>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{faq.a[props.lang]}</p>
            </details>
          ))}
        </div>

        <div className="mt-14 text-center">
          <button
            onClick={props.onCtaClick}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.25)]"
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
