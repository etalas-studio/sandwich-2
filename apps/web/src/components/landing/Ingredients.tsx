'use client'

import { TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface IngredientItem {
  img: string
  name: string
  desc: string
}

export function IngredientsGrid({ items }: { items: IngredientItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.name} className="rounded-2xl border border-black/10 bg-black/[0.02] hover:bg-black/[0.04] transition-colors p-6 flex flex-col items-center text-center">
          <img src={item.img} alt={item.name} loading="lazy" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md mb-4" />
          <h3 className="tracking-tight font-medium text-sm uppercase" style={{ color: TEXT_PRIMARY }}>{item.name}</h3>
          <p className="text-xs mt-1.5" style={{ color: TEXT_MUTED }}>{item.desc}</p>
        </div>
      ))}
    </div>
  )
}
