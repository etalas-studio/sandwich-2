'use client'

import { LIGHT_TEXT_MUTED } from './tokens'

const LOGOS = [
  'Google', 'Stripe', 'Airbnb', 'Spotify', 'Notion',
  'Figma', 'Vercel', 'Slack', 'Netflix', 'OpenAI',
  'Linear', 'Discord', 'Dropbox',
]

export function LogoCloud({ label }: { label: string }) {
  const track = (
    <div className="flex items-center gap-16 shrink-0">
      {LOGOS.map((name) => (
        <span
          key={name}
          className="text-2xl md:text-3xl font-semibold tracking-tight whitespace-nowrap select-none"
          style={{ color: LIGHT_TEXT_MUTED, opacity: 0.35 }}
        >
          {name}
        </span>
      ))}
    </div>
  )

  return (
    <section className="relative z-20 py-10 overflow-hidden">
      <p className="text-center text-xs font-medium uppercase tracking-widest mb-6" style={{ color: LIGHT_TEXT_MUTED, opacity: 0.5 }}>
        {label}
      </p>
      <div className="flex gap-16" style={{ animation: 'marquee 30s linear infinite' }}>
        {track}
        {track}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
