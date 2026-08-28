'use client'

import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, LIGHT_TEXT_SECONDARY, FONT_SERIF } from './tokens'

export interface ComparisonProps {
  kicker: string
  titleSans: string
  titleSerif: string
  desc: string
  colAspect: string
  colSandwich: string
  colManual: string
  rows: { aspect: string; sandwich: string; manual: string }[]
}

export function Comparison(props: ComparisonProps) {
  return (
    <section id="comparison" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="max-w-3xl">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <iconify-icon icon="solar:graph-up-linear" width="14" /><span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY }}>
            {props.titleSans}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
          </h2>
          <p className="mt-4 md:text-lg text-base leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{props.desc}</p>
        </div>

        <div className="mt-14 w-full overflow-hidden rounded-3xl ring-1 ring-black/5">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-black/5">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 flex items-center gap-2 border-l border-black/5" style={{ background: `${ACCENT}08` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: ACCENT }}>S</div>
              <span className="text-xs font-semibold" style={{ color: ACCENT }}>{props.colSandwich}</span>
            </div>
            <div className="px-6 py-4 flex items-center gap-2 border-l border-black/5">
              <span className="text-xs font-semibold" style={{ color: '#b0b7c3' }}>{props.colManual}</span>
            </div>
          </div>

          {props.rows.map((row, i) => (
            <div key={row.aspect} className="grid grid-cols-[1fr_1fr_1fr] border-b border-black/5 last:border-b-0" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <div className="px-6 py-5 flex items-center">
                <span className="text-sm" style={{ color: LIGHT_TEXT_SECONDARY }}>{row.aspect}</span>
              </div>
              <div className="px-6 py-5 flex items-center gap-2.5 border-l border-black/5" style={{ background: `${ACCENT}05` }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${ACCENT}18` }}>
                  <iconify-icon icon="solar:check-linear" width="10" style={{ color: ACCENT }} />
                </div>
                <span className="text-sm font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>{row.sandwich}</span>
              </div>
              <div className="px-6 py-5 flex items-center gap-2.5 border-l border-black/5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-neutral-100">
                  <iconify-icon icon="solar:minus-linear" width="10" style={{ color: '#c4c9d4' }} />
                </div>
                <span className="text-sm" style={{ color: '#b0b7c3' }}>{row.manual}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
