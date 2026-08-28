'use client'

import { useState } from 'react'
import { FAQS, FAQ_CATEGORIES } from '../../lib/faqs'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, LIGHT_BORDER, FONT_SERIF } from './tokens'

export interface FaqProps {
  kicker: string
  titleSans: string
  titleSerif: string
  lang: 'en' | 'id'
  // Kept for API-consistency with the existing landing wiring, but the
  // accordion now manages its own open state internally.
  openFaq?: number | null
  setOpenFaq?: (i: number | null) => void
}

export function Faq(props: FaqProps) {
  const [category, setCategory] = useState<string>('All Questions')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const faqs = category === 'All Questions' ? FAQS : FAQS.filter((f) => f.category === category)

  return (
    <section id="faq" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8">
        {/* Centered heading */}
        <div className="text-center mb-16">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <iconify-icon icon="solar:star-shine-linear" width="13" /><span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl tracking-tight font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>
            {props.titleSans}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
          </h2>
        </div>

        {/* Two-column: left intro + categories, right accordion */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Left rail */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <p className="text-base leading-relaxed mb-10 max-w-md" style={{ color: LIGHT_TEXT_MUTED }}>
              {faqsLabel(props)}
            </p>

            <p className="text-xs font-medium tracking-widest mb-3" style={{ color: LIGHT_TEXT_MUTED }}>
              Browse by category
            </p>
            <div className="flex flex-wrap gap-2">
              {FAQ_CATEGORIES.map((cat) => {
                const active = cat === category
                const count = cat === 'All Questions' ? FAQS.length : FAQS.filter((f) => f.category === cat).length
                return (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setOpenFaq(0) }}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors duration-200 ${
                      active ? 'text-white' : 'text-neutral-900 hover:bg-black/5'
                    }`}
                    style={
                      active
                        ? { backgroundColor: ACCENT, borderColor: ACCENT, boxShadow: '0 0 0 1px ' + ACCENT }
                        : { backgroundColor: 'rgba(0,0,0,0.02)', borderColor: LIGHT_BORDER }
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-neutral-400'}`} />
                    {cat}
                    <span className={`text-xs ${active ? 'text-white/80' : 'text-neutral-400'}`}>{count}</span>
                  </button>
                )
              })}
            </div>

            <p className="mt-6 text-sm" style={{ color: LIGHT_TEXT_MUTED }}>
              {categoryHint(props, category)}
            </p>
          </div>

          {/* Right accordion */}
          <div className="lg:col-span-7 space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="rounded-2xl overflow-hidden bg-neutral-50 ring-1 ring-black/10"
                open={openFaq === i}
                onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i) }}
              >
                <summary className="w-full px-6 py-5 flex items-center justify-between text-left text-base font-medium cursor-pointer list-none" style={{ color: LIGHT_TEXT_PRIMARY }}>
                  {faq.q[props.lang]}
                  <iconify-icon
                    icon="solar:add-circle-linear"
                    className={`transition-transform duration-300 shrink-0 ${openFaq === i ? 'rotate-45' : ''}`}
                    style={{ color: LIGHT_TEXT_MUTED }}
                  />
                </summary>
                <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{faq.a[props.lang]}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function faqsLabel(props: FaqProps) {
  if (props.lang === 'id') {
    return 'Pertanyaan yang paling sering ditanya sebelum mulai pakai SANDWICH dan jawaban cepatnya, biar kamu langsung paham alurnya.'
  }
  return 'The questions people ask most before getting started with SANDWICH and quick answers, so you understand the flow right away.'
}

function categoryHint(props: FaqProps, category: string) {
  if (props.lang === 'id') {
    return `Pilih kategori buat fokus ke pertanyaan yang relevan, atau lihat semuanya sekaligus.`
  }
  return `Pick a category to focus on the questions that matter, or view everything at once.`
}
