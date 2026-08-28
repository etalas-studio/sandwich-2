'use client'

import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_SECONDARY, LIGHT_TEXT_MUTED, FONT_SERIF } from './tokens'

export interface HarnessesProps {
  kicker: string
  title: string
  titleSerif: string
  desc: string
}

export function Harnesses(props: HarnessesProps) {
  return (
    <section id="harnesses" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24">
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <div
              className="aspect-[16/11] md:aspect-[5/4] overflow-hidden rounded-3xl relative border"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A' }}
            >
              <img
                src="/harnesses-spec.webp"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium ring-1 ring-black/10 w-fit" style={{ color: LIGHT_TEXT_SECONDARY }}>
              {props.kicker}
            </div>

            <h2 className="sm:text-5xl md:text-6xl md:font-normal md:tracking-tighter text-4xl font-semibold tracking-tight mt-4" style={{ color: LIGHT_TEXT_PRIMARY }}>
              {props.title}{' '}
              <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
            </h2>

            <p className="md:mt-5 md:text-lg leading-relaxed text-base mt-5" style={{ color: LIGHT_TEXT_MUTED }}>
              {props.desc}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
