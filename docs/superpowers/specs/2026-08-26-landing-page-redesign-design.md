# Landing Page Redesign Design

## Overview

Restyle the Spectr marketing landing page (`apps/web/src/components/LandingPage.tsx`) to match the visual language of a reference React landing page the user provided (a "Limited" design-agency template: glass pill nav, video/animated hero background, manifesto quote block, ecosystem cards with a big feature banner, numbered process steps with connecting line, branded pricing cards, application-form-style final CTA, footer). **All existing Spectr copy, content, sections, i18n strings, and interactive behavior are kept — only the visual system and component structure change.**

Not a content rewrite. Not a new product. Not a new pricing model.

## Visual system changes

- **Accent color**: replace lime `#c6f91f` with a blue scale (primary `#3b82f6`, deeper `#2554c7`/`#1d4ed8` for gradients/hovers), used everywhere `ACCENT` is currently referenced (buttons, badges, highlighted pricing card, checkmarks, glow effects).
- **Font**: replace Geist Variable with Inter Variable (`@fontsource-variable/inter`). Update `layout.tsx` import and `tailwind.config.js` `fontFamily.sans`. Remove the now-unused Geist import; leave the Google Fonts `<link>` for Bowlby One / Mouse Memoirs alone (unrelated, used elsewhere per the earlier exploration — verify before touching).
- **Background**: new `HeroBackgroundVideo` component — `<video autoPlay muted loop playsInline>` with `object-cover`, absolutely positioned behind the hero (matching the reference's `aura-background-component` wrapper). Source path: `apps/web/public/videos/hero-background.webm` (file to be supplied by the user later). Until the file exists, render a CSS aurora/gradient fallback (radial blue blobs, slow `background-position` animation) so the page always looks intentional — the `<video>` element's `onError`/missing-source case falls back to the same CSS class, no broken-video UI.
- **Glass nav pill**: restyle the existing sticky nav into the referenced rounded glass pill (`bg-white/5 border-white/10 backdrop-blur-lg rounded-full`), keeping all current links/behavior (EN/ID toggle, Login, primary CTA, mobile hamburger).
- **Scroll-reveal animation**: keep the existing `IntersectionObserver` + CSS keyframe approach, but adopt the reference's easing/composition (`fadeSlideIn`: opacity + translateY + slight blur, staggered per-child delay via inline `animation-delay`). No new dependency.

## Component architecture

Split the current single ~1020-line `LandingPage.tsx` into the file itself (composition/state/effects) plus section components colocated in a new `apps/web/src/components/landing/` directory:

- `landing/Nav.tsx` — glass pill nav + mobile menu
- `landing/Hero.tsx` — headline, CTA row, interactive prompt panel (existing logic: deliverable-type select, textarea, submit routing, localStorage draft, PostHog `plan_selected`/prompt events — moved, not rewritten)
- `landing/HeroBackgroundVideo.tsx` — video/gradient-fallback background
- `landing/FormatMarquee.tsx` — PRD/SPECS/PROTOTYPE/QUOTATION/MOM scrolling strip
- `landing/Harnesses.tsx` — "Messy input. Clean spec." manifesto-style quote block (reusing existing harnesses copy + illustration)
- `landing/Pipeline.tsx` — 4-step process path (numbered circles + connecting line, reusing existing 4 steps)
- `landing/Ingredients.tsx` — 4-card ecosystem grid (PRD/Prototype/Quotation/Specs)
- `landing/SampleOutputsBanner.tsx` — existing 4 sample-output cards, restyled as the reference's "big feature" banner treatment: one stacked banner per sample (four banners in sequence), not a carousel/tabs — keeps all four equally visible with no added interaction state
- `landing/Differentiators.tsx` — existing 4-card grid, one highlighted
- `landing/Pricing.tsx` — existing 2-plan grid (Starter/Pro), restyled card treatment (price, feature checklist, "Best value" badge, CTA)
- `landing/FinalCta.tsx` — closing CTA section reusing the same prompt-panel interaction pattern as Hero (not a new multi-field form)
- `landing/Faq.tsx` — existing accordion, restyled
- `landing/Footer.tsx` — existing footer content, restyled

Each section component receives already-resolved copy (from the existing `i18n.tsx` `t()` lookups) as props from `LandingPage.tsx`, so i18n stays centralized exactly as it is today — components don't call `useI18n` themselves except where the current code already does (e.g. language toggle in nav).

`LandingPage.tsx` after the split: imports + state (auth check, language, prompt form state, scroll-reveal effect setup) + renders the section components in order. Should land well under 300 lines.

## Section-by-section mapping (approved)

| Reference section | Spectr section | Content source |
|---|---|---|
| Nav pill | Nav pill | existing nav links/behavior |
| Hero | Hero | existing headline + interactive prompt panel |
| Trusted-by logo strip | Format marquee | existing PRD/SPECS/PROTOTYPE/QUOTATION/MOM chips |
| Manifesto quote block | Harnesses | existing "Messy input. Clean spec." copy |
| Us vs Them comparison | **Skipped** | no existing comparison content — not inventing new claims |
| Ecosystem (3 cards + big banner) | Ingredients (4 cards) + Sample Outputs (banner) | existing ingredients + sample-output copy |
| Process path (3 steps) | Pipeline (4 steps) | existing 4-step copy, adapted to circle+line pattern |
| Pricing grid | Pricing (2 tiers) | existing Starter/Pro data from `apps/web/src/lib/plans.ts` |
| Application form | Final CTA banner | reuses the hero's prompt-panel interaction, not a new form |
| — | FAQ | existing 5 Q&A (reference has no FAQ section) |
| Footer | Footer | existing footer content |

## Testing / verification

No unit tests exist for `LandingPage.tsx` today (it's a presentational client component) and this change doesn't add new business logic — verification is manual:

1. `npm --prefix apps/web run build` succeeds (typecheck + Next build).
2. Run `npm --prefix apps/web run dev`, visually check the page in a browser at desktop and mobile widths, both `en` and `id` language states.
3. Confirm existing interactive behavior still works: hero prompt submit routing (unauthenticated → `/register` with draft saved to localStorage; authenticated+in-quota → `/dashboard`; authenticated+over-quota → `/pay?plan=pro`), nav anchor scrolling, mobile menu toggle, FAQ accordion, pricing CTA links, language toggle.
4. Confirm no console errors/warnings from the video element when the background file is absent (fallback renders cleanly).

## Out of scope

- Any new marketing copy, claims, testimonials, or comparison content not already in the codebase.
- Changing the pricing model/plans data (only visual restyle of the existing 2 cards).
- Adding UnicornStudio or any third-party 3D scene — background is video/CSS only.
- A new multi-field lead-capture form (the "application" section reuses the existing prompt-panel pattern instead).
- Sourcing or generating the actual background video file — the user will supply it; a CSS fallback covers its absence.
