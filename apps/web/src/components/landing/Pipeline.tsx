'use client'

import { useState } from 'react'
import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, FONT_SERIF } from './tokens'

export interface PipelineStep {
  n: string
  icon: string
  title: string
  desc: string
  image: string
}

export interface PipelineProps {
  kicker: string
  titleLine1: string
  titleLine2: string
  desc: string
  steps: PipelineStep[]
}

export function Pipeline(props: PipelineProps) {
  // First card is expanded by default. Hovering a card expands it sideways
  // (to the width of card 1) and shrinks the others. Leaving the row resets.
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="pipeline" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        {/* Heading */}
        <div className="max-w-3xl">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY }}>
            {props.titleLine1}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF, color: LIGHT_TEXT_MUTED }}>{props.titleLine2}</span>
          </h2>
          <p className="md:mt-4 mt-3 md:text-lg text-base leading-relaxed" style={{ color: LIGHT_TEXT_MUTED }}>{props.desc}</p>
        </div>

        {/* Horizontal accordion — hover expands a card to the right (card 1's width),
            the others shrink. Content appears inside the expanded card. */}
        <div
          className="flex flex-col md:flex-row gap-4 items-stretch mt-10"
          onMouseLeave={() => setOpen(null)}
        >
          {props.steps.map((s, i) => {
            const isOpen = open === i
            return (
              <div
                key={s.n}
                onMouseEnter={() => setOpen(i)}
                onClick={() => setOpen(i)}
                className={`relative overflow-hidden rounded-3xl cursor-pointer min-w-0 transition-all duration-500 ease-out ${
                  isOpen ? 'md:flex-[2.2]' : 'md:flex-1'
                }`}
                style={{ height: '26rem', flexBasis: 0 }}
              >
                <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/35" />

                {/* Top label: number */}
                <div className="absolute top-5 left-6 z-10 flex items-center gap-3">
                  <span className="font-serif italic text-2xl md:text-3xl tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {s.n}
                  </span>
                </div>

                {/* Bottom text — title only when open on mobile, always on desktop collapsed */}
                <div className="absolute bottom-0 inset-x-0 z-10 p-6 md:p-7">
                  <h3
                    className={`font-normal tracking-tight text-white leading-tight transition-all duration-300 ${isOpen ? 'text-3xl md:text-4xl opacity-100' : 'text-lg md:text-xl opacity-0'}`}
                  >
                    {s.title}
                  </h3>
                  <div
                    className="overflow-hidden transition-all duration-500 ease-out"
                    style={{
                      maxWidth: isOpen ? '30rem' : '0px',
                      opacity: isOpen ? 1 : 0,
                      marginTop: isOpen ? '0.5rem' : '0',
                    }}
                  >
                    <p className="text-base md:text-lg leading-relaxed text-white/85">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
