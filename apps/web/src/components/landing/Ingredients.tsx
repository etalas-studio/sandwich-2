'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface IngredientItem {
  img: string
  name: string
  desc: string
}

export interface IngredientsProps {
  kicker: string
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
  items: IngredientItem[]
}

export function Ingredients(props: IngredientsProps) {
  return (
    <section id="about" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <div id="about-head" className={props.reveal('about-head', 'text-center mb-14')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight mb-4" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="max-w-lg mx-auto text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{props.desc}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {props.items.map((item) => (
            <div key={item.name} className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-6 flex flex-col items-center text-center">
              <img src={item.img} alt={item.name} loading="lazy" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md mb-4" />
              <h3 className="tracking-tight font-medium text-sm uppercase" style={{ color: TEXT_PRIMARY }}>{item.name}</h3>
              <p className="text-xs mt-1.5" style={{ color: TEXT_MUTED }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
