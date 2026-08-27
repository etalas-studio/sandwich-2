# Project Style Guide

## Meta
- Reference slug(s): ai-sales-platform (base — landing page), source: https://ai-sales-engine.aura.build/
- Web benchmark(s): the aura.build "AI Sales Infrastructure" template itself (dark, dashed-grid, lime glow)
- Date: 2026-08-26
- Scope note: applies to the marketing landing page (`LandingPage.tsx`). The
  authenticated app (Dashboard, auth pages) is unchanged — still uses the
  older red/cream Bowlby One system.

## Palette
- bg: #05080A   panel: #0B0F13   panel-2: #0E1216   accent: #c6f91f (lime)
- text primary: #ffffff   text secondary: rgba(255,255,255,0.7)   text muted: rgba(255,255,255,0.45)
- border: rgba(255,255,255,0.1), dashed (signature — used everywhere: nav, section dividers, cards, footer)

## Typography
- Display/body font: Geist Variable (`@fontsource-variable/geist`, imported in `layout.tsx`), fallback Inter
- Kicker labels: font-mono, uppercase, tracking-widest, lime, with a small dot bullet
- Hero scale: text-5xl md:text-7xl, font-light, tracking-tighter, leading-[1.05]
- Section h2: text-4xl md:text-6xl, font-light, tracking-tighter

## Shape & depth
- Radius token: rounded-lg/rounded-xl (panels, cards), rounded-full (pills, badges, CTAs)
- Shadow token: layered dark shadow on glass panels (0 25.7px 20.5px rgba(0,0,0,0.12), 0 85.8px 68.5px rgba(0,0,0,0.18)); lime glow on hover (0 14px 30px rgba(198,249,31,0.25-0.3))
- Border style: dashed, rgba(255,255,255,0.1) — the page's core signature texture

## Spacing rhythm
- Section padding: py-24 md:py-32   Container max: max-w-7xl (wide), max-w-3xl/5xl (text)   Gap: gap-6

## Motion
- reveal-on-scroll — fade-up + blur-in (opacity 0→1, translateY 20→0, blur 8→0), CSS animation paused until `.is-visible` toggled by IntersectionObserver
- marquee — continuous horizontal scroll of pipeline stage labels inside a dashed-bordered strip, 32s linear infinite

## Icon set
- Solar (Iconify CDN, already in layout.tsx) — kept over the reference's Lucide to stay consistent with the rest of the app

## Signature move
- Dashed borders (`border-dashed border-white/10`) on every structural line — nav, section top borders, bento-grid dividers, card borders, footer
- Bento-grid cards with 1px hairline gaps (bg-border trick) instead of individually-rounded cards
- Glass hero panel with layered shadow + lime hairline top-edge glow
- Lime glow blobs (blur-140px, low opacity) behind hero/pricing

## Section structure (matches ai-sales-platform's layout, not just its colors)
1. Sticky nav (unchanged position — floating dashed pill)
2. Hero — split 2-col: left = badge + h1 + tagline + dashed-divided CTA button pair; right = the glass prompt panel (SANDWICH's version of the reference's dashboard mockup slot)
3. Full-bleed marquee strip directly under hero — dashed label column + scrolling output-format row (maps to the reference's "TRUSTED TEAMS" strip position)
4. Harnesses (output types), Pipeline (bento grid), About (ingredients), Samples (terminal-style cards), Differentiators (bento grid), Pricing, FAQ, Footer — unchanged content, all restyled to the dashed/glass/lime system above
