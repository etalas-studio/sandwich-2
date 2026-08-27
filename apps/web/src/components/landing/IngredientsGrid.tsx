'use client'

import { GridLines } from './GridLines'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './tokens'

export interface IngredientsGridProps {
  kicker: string
  title: string
  desc: string
  linkLabel: string
  onLinkClick: () => void
  items: { title: string; desc: string }[]
}

export function IngredientsGrid(props: IngredientsGridProps) {
  const [prd, prototype, quotation, specs] = props.items

  return (
    <section id="ingredients" className="overflow-hidden relative z-10 py-32 px-6 lg:px-12 scroll-mt-24">
      <GridLines />
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(50% 40% at 90% 0%, ${ACCENT}14, transparent 70%)` }} />

      <div className="relative max-w-7xl mr-auto ml-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start mb-16 gap-12">
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: LIGHT_TEXT_MUTED }}>{props.kicker}</p>
            <h2 className="text-5xl md:text-6xl font-semibold tracking-tighter max-w-4xl leading-[0.95]" style={{ color: LIGHT_TEXT_PRIMARY }}>{props.title}</h2>
          </div>
          <div className="max-w-md flex flex-col gap-6 lg:pt-2">
            <p className="text-lg font-light leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{props.desc}</p>
            <button onClick={props.onLinkClick} className="group inline-flex items-center font-medium hover:text-neutral-600 transition-colors text-left" style={{ color: LIGHT_TEXT_PRIMARY }}>
              <span>{props.linkLabel}</span>
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: PRD — stacked layers */}
          <div className="group relative h-96 rounded-[2rem] bg-neutral-50 overflow-hidden border border-black/5 transition-colors duration-500 hover:bg-neutral-100 hover:border-black/10">
            <div className="absolute inset-0 flex items-center justify-center opacity-80" style={{ perspective: '1000px' }}>
              <div className="relative w-32 h-32 transform transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-2.5">
                <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent border border-black/10 rounded-2xl transform -translate-x-4 -translate-y-2 -rotate-[15deg] backdrop-blur-[2px] transition-transform duration-500 ease-out group-hover:-translate-x-8 group-hover:-rotate-[20deg]" />
                <div className="absolute inset-0 bg-gradient-to-br from-black/15 to-transparent border border-black/15 rounded-2xl -rotate-[5deg] backdrop-blur-[4px] transition-transform duration-500 delay-75 ease-out group-hover:rotate-0" />
                <div className="absolute inset-0 bg-white border border-black/20 rounded-2xl transform translate-x-4 translate-y-2 rotate-[5deg] backdrop-blur-[6px] shadow-xl transition-transform duration-500 delay-150 ease-out group-hover:translate-x-8 group-hover:rotate-[15deg] flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/15 blur-xl" />
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between z-10">
              <div className="flex flex-col gap-2 max-w-[70%]">
                <h3 className="text-xl font-medium tracking-tight leading-none group-hover:text-indigo-600 transition-colors" style={{ color: LIGHT_TEXT_PRIMARY }}>{prd?.title}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{prd?.desc}</p>
              </div>
              <span className="w-12 h-12 rounded-full border border-black/10 bg-black/5 flex items-center justify-center text-neutral-500 transition-all duration-300 group-hover:bg-black group-hover:text-white group-hover:scale-110">
                <iconify-icon icon="solar:document-text-linear" width="18" />
              </span>
            </div>
          </div>

          {/* Card 2: Prototype — speed lines */}
          <div className="group relative h-96 rounded-[2rem] bg-neutral-50 overflow-hidden border border-black/5 transition-colors duration-500 hover:bg-neutral-100 hover:border-black/10">
            <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
              <div className="relative w-full h-full opacity-50 group-hover:opacity-70 transition-opacity duration-500">
                <div className="absolute top-1/4 left-[-20%] w-[140%] h-px bg-gradient-to-r from-transparent via-black/40 to-transparent transform -rotate-12 -translate-x-[10%] group-hover:translate-x-[10%] transition-transform duration-[2s] ease-in-out" />
                <div className="absolute top-1/3 left-[-20%] w-[140%] h-px bg-gradient-to-r from-transparent via-black/20 to-transparent transform -rotate-12 -translate-x-[20%] group-hover:translate-x-[5%] transition-transform duration-[2.5s] ease-in-out delay-75" />
                <div className="absolute top-1/2 left-[-20%] w-[140%] h-px bg-gradient-to-r from-transparent via-black/50 to-transparent transform -rotate-12 -translate-x-[15%] group-hover:translate-x-[15%] transition-transform duration-[1.8s] ease-in-out delay-100" />
                <div className="absolute top-2/3 left-[-20%] w-[140%] h-px bg-gradient-to-r from-transparent via-black/30 to-transparent transform -rotate-12 -translate-x-[5%] group-hover:translate-x-[20%] transition-transform duration-[2.2s] ease-in-out delay-150" />
                <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-emerald-500/15 rounded-full blur-[60px] transform -translate-x-1/2 -translate-y-1/2 group-hover:bg-emerald-500/25 transition-colors duration-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between z-10">
              <div className="flex flex-col gap-2 max-w-[70%]">
                <h3 className="text-xl font-medium tracking-tight leading-none group-hover:text-emerald-600 transition-colors" style={{ color: LIGHT_TEXT_PRIMARY }}>{prototype?.title}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{prototype?.desc}</p>
              </div>
              <span className="w-12 h-12 rounded-full border border-black/10 bg-black/5 flex items-center justify-center text-neutral-500 transition-all duration-300 group-hover:bg-black group-hover:text-white group-hover:scale-110">
                <iconify-icon icon="solar:widget-2-linear" width="18" />
              </span>
            </div>
          </div>

          {/* Card 3: Quotation — isometric grid */}
          <div className="group relative h-96 rounded-[2rem] bg-neutral-50 overflow-hidden border border-black/5 transition-colors duration-500 hover:bg-neutral-100 hover:border-black/10">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ perspective: '800px' }}>
              <div className="relative transform scale-75 group-hover:scale-90 transition-transform duration-700 ease-out" style={{ transform: 'rotateX(60deg) rotateZ(45deg)' }}>
                <div className="w-48 h-48 border border-black/10 bg-black/5 grid grid-cols-4 grid-rows-4 rounded-lg shadow-xl">
                  <div className="border-r border-b border-black/5" /><div className="border-r border-b border-black/5" /><div className="border-r border-b border-black/5" /><div className="border-b border-black/5" />
                  <div className="border-r border-b border-black/5" /><div className="border-r border-b border-black/5 bg-rose-500/10 transition-colors duration-300 group-hover:bg-rose-500/20" /><div className="border-r border-b border-black/5" /><div className="border-b border-black/5" />
                  <div className="border-r border-b border-black/5" /><div className="border-r border-b border-black/5" /><div className="border-r border-b border-black/5" /><div className="border-b border-black/5" />
                  <div className="border-r border-black/5" /><div className="border-r border-black/5" /><div className="border-r border-black/5" /><div />
                </div>
                <div className="absolute -top-10 left-10 w-16 h-16 bg-neutral-900 border border-black/20 rounded-xl shadow-xl transition-transform duration-500 ease-out flex items-center justify-center" style={{ transform: 'translateZ(20px)' }}>
                  <iconify-icon icon="solar:money-bag-linear" width="22" className="text-rose-400" />
                </div>
                <div className="absolute top-1/2 left-1/2 w-0.5 h-20 bg-gradient-to-b from-rose-500/50 to-transparent transform -translate-x-1/2 -translate-y-1/2 group-hover:h-32 transition-all duration-700 ease-out origin-top" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between z-10">
              <div className="flex flex-col gap-2 max-w-[70%]">
                <h3 className="text-xl font-medium tracking-tight leading-none group-hover:text-rose-600 transition-colors" style={{ color: LIGHT_TEXT_PRIMARY }}>{quotation?.title}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{quotation?.desc}</p>
              </div>
              <span className="w-12 h-12 rounded-full border border-black/10 bg-black/5 flex items-center justify-center text-neutral-500 transition-all duration-300 group-hover:bg-black group-hover:text-white group-hover:scale-110">
                <iconify-icon icon="solar:money-bag-linear" width="18" />
              </span>
            </div>
          </div>

          {/* Card 4: Specs — lens/focus rings */}
          <div className="group relative h-96 rounded-[2rem] bg-neutral-50 overflow-hidden border border-black/5 transition-colors duration-500 hover:bg-neutral-100 hover:border-black/10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-black/10 group-hover:scale-125 transition-transform duration-700 ease-out" />
                <div className="absolute inset-4 rounded-full border border-black/10 group-hover:scale-110 transition-transform duration-700 delay-75 ease-out" />
                <div className="absolute inset-8 rounded-full border border-black/15 group-hover:scale-105 transition-transform duration-700 delay-150 ease-out border-dashed opacity-50" />
                <div className="absolute inset-0 animate-[spin_12s_linear_infinite] group-hover:[animation-duration:4s] opacity-40">
                  <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-neutral-900 -translate-x-1/2" />
                  <div className="absolute bottom-0 left-1/2 w-0.5 h-2 bg-neutral-900 -translate-x-1/2" />
                  <div className="absolute left-0 top-1/2 w-2 h-0.5 bg-neutral-900 -translate-y-1/2" />
                  <div className="absolute right-0 top-1/2 w-2 h-0.5 bg-neutral-900 -translate-y-1/2" />
                </div>
                <div className="w-16 h-16 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-colors duration-500" />
                <div className="w-2 h-2 rounded-full bg-neutral-900 shadow-[0_0_15px_rgba(0,0,0,0.25)] z-10 absolute" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between z-10">
              <div className="flex flex-col gap-2 max-w-[70%]">
                <h3 className="text-xl font-medium tracking-tight leading-none group-hover:text-blue-600 transition-colors" style={{ color: LIGHT_TEXT_PRIMARY }}>{specs?.title}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{specs?.desc}</p>
              </div>
              <span className="w-12 h-12 rounded-full border border-black/10 bg-black/5 flex items-center justify-center text-neutral-500 transition-all duration-300 group-hover:bg-black group-hover:text-white group-hover:scale-110">
                <iconify-icon icon="solar:list-check-linear" width="18" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
