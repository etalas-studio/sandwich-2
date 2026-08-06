# Project Style Guide

## Meta
- Reference slug(s): axisflow-saas (base), api-infrastructure (hero scale)
- Web benchmark(s): Linear (whitespace discipline), Stripe (CTA hierarchy)
- Date: 2026-08-06

## Palette
- bg: #ffffff   surface: #fafafa   primary: #f91814
- accent: #0a0a0a   text: #0a0a0a   muted: #6b7280
- cream section: #F4EBE1   yellow section: #F9CD25   dark section: #0a0a0a

## Typography
- Display font: Bowlby One   Body font: Plus Jakarta Sans
- Hero scale: clamp(3.5rem, 7vw, 6rem), tracking-tight, leading-[0.95]
- Section h2: clamp(2.5rem, 5vw, 4rem), font-medium

## Shape & depth
- Radius token: rounded-2xl (cards), rounded-full (badges, CTAs), rounded-lg (inputs)
- Shadow token: 0 4px 24px rgba(0,0,0,0.05) (cards), inset 0 1px 0 rgba(255,255,255,0.1) (dark CTAs)

## Spacing rhythm
- Section padding: py-28   Container max: max-w-6xl (wide), max-w-4xl (text)   Gap: gap-5

## Motion
- animationIn — hero entrance (opacity 0→1, translateY 24→0, blur 6→0) on page load, staggered by element
- marquee-scroll — pipeline section continuous horizontal scroll, 28s

## Icon set
- Solar (Iconify CDN, already in index.html)

## Signature move
- Marquee pipeline strip (dark section, colored dot labels)
- Hero entrance with blur+slide animation (axisflow-saas animationIn keyframe)
