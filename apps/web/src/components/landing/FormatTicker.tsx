'use client'

import { TEXT_MUTED, TEXT_PRIMARY } from './tokens'

const FORMATS = ['PRD', 'SPECS', 'PROTOTYPE', 'QUOTATION', 'MOM']

export function FormatTicker({ label }: { label: string }) {
  const track = (
    <div className="flex items-center gap-16 shrink-0">
      {FORMATS.map((f) => (
        <div key={f} className="flex items-center gap-3 transition-colors duration-300" style={{ color: TEXT_MUTED }}>
          <span className="text-lg font-medium tracking-tighter" style={{ color: TEXT_PRIMARY }}>{f}</span>
        </div>
      ))}
    </div>
  )

  return (
    <section className="z-10 sm:pb-12 sm:pt-12 pt-8 pb-8 relative">
      <style>{`
        @keyframes sw-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .sw-ticker-track { animation: sw-ticker 30s linear infinite; width: max-content; }
        .sw-ticker-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="sm:px-6 lg:px-8 max-w-7xl mr-auto ml-auto pr-4 pl-4">
        <div className="text-center mb-12">
          <p className="uppercase text-xs font-medium tracking-wide" style={{ color: TEXT_MUTED }}>{label}</p>
        </div>

        <div
          className="overflow-hidden relative"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
          }}
        >
          <div className="sw-ticker-track flex gap-16 pt-2 pb-2 items-center">
            {track}
            {track}
          </div>
        </div>
      </div>
    </section>
  )
}
