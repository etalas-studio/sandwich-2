'use client'

import { TEXT_MUTED, TEXT_PRIMARY } from './tokens'

const FORMATS = ['PRD', 'SPECS', 'PROTOTYPE', 'QUOTATION', 'MOM']

export function FormatMarquee({ label }: { label: string }) {
  return (
    <div className="relative z-10 grid grid-cols-12 border-b border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="col-span-12 md:col-span-2 py-6 px-6 md:px-10 border-b md:border-b-0 md:border-r border-white/10 flex items-center">
        <span className="text-xs font-medium tracking-widest uppercase" style={{ color: TEXT_MUTED }}>{label}</span>
      </div>
      <div
        className="col-span-12 md:col-span-10 relative overflow-hidden h-16 flex items-center"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
      >
        <div className="flex w-max sw-marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0">
              {FORMATS.map((f) => (
                <div key={f} className="w-40 h-16 flex-shrink-0 flex items-center justify-center border-r border-white/10 opacity-50 hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium tracking-tighter" style={{ color: TEXT_PRIMARY }}>{f}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
