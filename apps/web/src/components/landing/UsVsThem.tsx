'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

// Mechanical opposites of the four approved differentiator claims (diff_1..4
// in i18n.tsx) — not a claim about any named competitor, just "without a
// structured pipeline" framed against SANDWICH's own approved copy.
const WITHOUT_ITEMS = {
  en: [
    'Overwrites your last version',
    'Lost when the chat session ends',
    'No way to share without an account',
    'Dumps everything on you at once',
  ],
  id: [
    'Menimpa versi terakhir kamu',
    'Hilang begitu sesi chat berakhir',
    'Gak bisa dibagikan tanpa kasih akun',
    'Semua ditumpahin sekaligus',
  ],
}

const LABELS = {
  en: { without: 'Without a pipeline', sandwich: 'With SANDWICH' },
  id: { without: 'Tanpa pipeline', sandwich: 'Dengan SANDWICH' },
}

export interface UsVsThemProps {
  title: string
  reveal: (id: string, extra?: string) => string
  lang: 'en' | 'id'
  sandwichItems: string[]
}

export function UsVsThem(props: UsVsThemProps) {
  const withoutItems = WITHOUT_ITEMS[props.lang]
  const labels = LABELS[props.lang]

  return (
    <section id="differentiators" className="py-24 md:py-32 border-t border-black/5 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <div id="us-vs-them-head" className={props.reveal('us-vs-them-head', 'text-center mb-16')}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl border border-black/10 bg-black/[0.02] flex flex-col gap-6 opacity-80 transition hover:opacity-100">
            <h3 className="text-xl font-medium" style={{ color: TEXT_SECONDARY }}>{labels.without}</h3>
            <ul className="space-y-4">
              {withoutItems.map((item) => (
                <li key={item} className="flex items-center gap-3" style={{ color: TEXT_SECONDARY }}>
                  <iconify-icon icon="solar:close-circle-linear" width="20" className="text-red-500/70" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative p-8 rounded-2xl border border-blue-500/30 bg-blue-50 flex flex-col gap-6 shadow-[0_0_50px_-20px_rgba(59,130,246,0.5)]">
            <h3 className="text-xl font-medium" style={{ color: TEXT_PRIMARY }}>{labels.sandwich}</h3>
            <ul className="space-y-4">
              {props.sandwichItems.map((item) => (
                <li key={item} className="flex items-center gap-3" style={{ color: TEXT_PRIMARY }}>
                  <div className="bg-blue-500/20 p-1 rounded-full shrink-0">
                    <iconify-icon icon="solar:check-circle-linear" width="16" style={{ color: ACCENT }} />
                  </div>
                  <span className="text-sm font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
