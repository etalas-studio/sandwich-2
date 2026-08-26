'use client'

import { FAQS } from '../../lib/faqs'
import { PANEL_2, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface FaqCtaProps {
  title: string
  desc: string
  lang: 'en' | 'id'
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
  ctaKicker: string
  ctaTitle: string
  ctaDesc: string
  ctaPrimary: string
  ctaSecondary: string
  onCtaPrimaryClick: () => void
  onCtaSecondaryClick: () => void
}

export function FaqCta(props: FaqCtaProps) {
  return (
    <section id="faq" className="py-24 md:py-32 px-6 max-w-7xl mx-auto border-t scroll-mt-24" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-5">
          <h2 className="text-3xl md:text-4xl tracking-tight font-medium mb-6" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="text-sm mb-10 leading-relaxed max-w-md" style={{ color: TEXT_MUTED }}>{props.desc}</p>
        </div>

        <div className="lg:col-span-7 space-y-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="border rounded-2xl overflow-hidden"
              style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: PANEL_2 }}
              open={props.openFaq === i}
              onClick={(e) => { e.preventDefault(); props.setOpenFaq(props.openFaq === i ? null : i) }}
            >
              <summary className="w-full px-6 py-5 flex items-center justify-between text-left text-sm font-medium cursor-pointer list-none" style={{ color: TEXT_PRIMARY }}>
                {faq.q[props.lang]}
                <iconify-icon
                  icon="solar:add-circle-linear"
                  className={`transition-transform duration-300 ${props.openFaq === i ? 'rotate-45' : ''}`}
                  style={{ color: TEXT_MUTED }}
                />
              </summary>
              <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>{faq.a[props.lang]}</div>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="mt-32 p-10 md:p-16 rounded-[2.5rem] border flex flex-col md:flex-row items-center justify-between gap-8"
        style={{ background: `linear-gradient(180deg, ${PANEL_2} 0%, #000000 100%)`, borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-xl">
          <span className="text-xs uppercase tracking-widest mb-3 block" style={{ color: TEXT_MUTED }}>{props.ctaKicker}</span>
          <h3 className="text-3xl md:text-4xl tracking-tight font-medium mb-4" style={{ color: TEXT_PRIMARY }}>{props.ctaTitle}</h3>
          <p className="text-sm" style={{ color: TEXT_MUTED }}>{props.ctaDesc}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={props.onCtaPrimaryClick}
            className="px-8 py-3.5 rounded-full text-sm font-medium text-center hover:scale-105 transition-transform"
            style={{ backgroundColor: '#ffffff', color: '#000000' }}
          >
            {props.ctaPrimary}
          </button>
          <button
            onClick={props.onCtaSecondaryClick}
            className="px-8 py-3.5 rounded-full border text-sm font-medium text-center transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: TEXT_PRIMARY }}
          >
            {props.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  )
}
