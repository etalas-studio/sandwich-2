'use client'

import { IngredientsGrid, type IngredientItem } from './Ingredients'
import { SampleBanners } from './SampleOutputsBanner'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface EcosystemProps {
  kicker: string
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
  ingredients: IngredientItem[]
}

export function Ecosystem(props: EcosystemProps) {
  return (
    <section id="about" className="py-24 md:py-32 border-t border-black/5 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <div id="about-head" className={props.reveal('about-head', 'text-center mb-14')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight mb-4" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="max-w-lg mx-auto text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <IngredientsGrid items={props.ingredients} />

        <div id="samples" className="mt-6 scroll-mt-24">
          <SampleBanners />
        </div>
      </div>
    </section>
  )
}
