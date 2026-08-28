'use client'

import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, FONT_SANS, FONT_SERIF } from './tokens'

export interface DeliverablesProps {
  kicker: string
  titleSans: string
  titleSerif: string
  desc: string
  colName: string
  colDesc: string
  rows: { name: string; desc: string }[]
}

function PrdIllustration() {
  return (
    <div className="relative w-36 h-36 flex items-end justify-center">
      <div className="absolute bottom-6 left-4 w-24 h-28 rounded-xl rotate-[-8deg]" style={{ background: 'linear-gradient(135deg, #a5b4fc, #818cf8)' }} />
      <div className="absolute bottom-6 left-6 w-24 h-28 rounded-xl rotate-[-3deg]" style={{ background: 'linear-gradient(135deg, #c7d2fe, #a5b4fc)' }} />
      <div className="absolute bottom-6 left-8 w-24 h-28 rounded-xl shadow-sm flex flex-col gap-1.5 p-3 pt-4" style={{ background: '#fff' }}>
        <div className="h-1.5 rounded w-4/5" style={{ background: '#6366f1' }} />
        <div className="h-1.5 rounded w-full" style={{ background: '#c7d2fe' }} />
        <div className="h-1.5 rounded w-3/4" style={{ background: '#c7d2fe' }} />
        <div className="h-1.5 rounded w-full" style={{ background: '#c7d2fe' }} />
        <div className="h-1.5 rounded w-1/2 mt-1" style={{ background: '#e0e7ff' }} />
        <div className="h-1.5 rounded w-5/6" style={{ background: '#e0e7ff' }} />
      </div>
    </div>
  )
}

function ProtoIllustration() {
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <div className="w-20 h-32 rounded-2xl shadow-sm flex flex-col overflow-hidden" style={{ border: '2px solid #67e8f9', background: '#fff' }}>
        <div className="h-4 border-b flex items-center justify-center" style={{ background: '#ecfeff', borderColor: '#a5f3fc' }}>
          <div className="w-6 h-1 rounded" style={{ background: '#67e8f9' }} />
        </div>
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="h-8 rounded" style={{ background: '#ecfeff' }} />
          <div className="h-1.5 rounded w-3/4" style={{ background: '#a5f3fc' }} />
          <div className="h-1.5 rounded w-full" style={{ background: '#a5f3fc' }} />
          <div className="h-5 rounded mt-auto" style={{ background: '#06b6d4' }} />
        </div>
      </div>
    </div>
  )
}

function QuotationIllustration() {
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <div className="w-28 h-28 rounded-2xl shadow-sm p-3 flex flex-col gap-2" style={{ background: '#fff', border: '1px solid #fbcfe8' }}>
        <div className="flex items-center justify-between">
          <div className="h-2 w-14 rounded" style={{ background: '#ec4899' }} />
          <div className="h-2 w-8 rounded" style={{ background: '#fbcfe8' }} />
        </div>
        <div className="border-t pt-2 flex flex-col gap-1.5" style={{ borderColor: '#fce7f3' }}>
          {[['Design', 12], ['Dev', 20], ['QA', 8]].map(([k, w]) => (
            <div key={String(k)} className="flex justify-between items-center">
              <div className="h-1.5 rounded" style={{ background: '#fbcfe8', width: `${w}px` }} />
              <div className="h-1.5 w-10 rounded" style={{ background: '#f9a8d4' }} />
            </div>
          ))}
        </div>
        <div className="border-t mt-auto flex justify-between items-center pt-1.5" style={{ borderColor: '#fbcfe8' }}>
          <span className="text-[9px] font-semibold" style={{ color: '#db2777' }}>Total</span>
          <div className="h-2 w-12 rounded" style={{ background: '#ec4899' }} />
        </div>
      </div>
    </div>
  )
}

function SpecsIllustration() {
  const items = [true, true, false, false]
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <div className="w-28 rounded-2xl shadow-sm p-3 flex flex-col gap-2" style={{ background: '#fff', border: '1px solid #d9f99d' }}>
        <div className="h-2 w-16 rounded mb-1" style={{ background: '#4ade80' }} />
        {items.map((done, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md border flex items-center justify-center shrink-0" style={done ? { background: '#16a34a', borderColor: '#16a34a' } : { background: '#fff', borderColor: '#bbf7d0' }}>
              {done && <svg viewBox="0 0 10 10" className="w-2.5 h-2.5"><polyline points="2,5 4,7.5 8,3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div className="h-1.5 rounded flex-1" style={{ background: done ? '#86efac' : '#dcfce7' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const ILLUSTRATIONS = [PrdIllustration, ProtoIllustration, QuotationIllustration, SpecsIllustration]

export function Deliverables(props: DeliverablesProps) {
  return (
    <section id="deliverables" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="max-w-3xl mb-14">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <iconify-icon icon="solar:document-text-linear" width="14" />
            <span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY }}>
            {props.titleSans}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
          </h2>
          <p className="mt-4 md:text-lg text-base leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{props.desc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {props.rows.map((row, i) => {
            const Illus = ILLUSTRATIONS[i] ?? ILLUSTRATIONS[0]
            return (
              <div key={row.name} className="rounded-3xl flex flex-col justify-between overflow-hidden" style={{ backgroundColor: '#f2f2f2', minHeight: '360px', padding: '28px' }}>
                <div className="flex items-center justify-center flex-1 py-4">
                  <Illus />
                </div>
                <div style={{ minHeight: '96px' }}>
                  <h3 className="text-base font-bold leading-snug mb-2" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>{row.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{row.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
