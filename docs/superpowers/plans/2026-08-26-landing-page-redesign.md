# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `apps/web/src/components/LandingPage.tsx` to match the visual language of the reference "Limited" agency template (glass pill nav, video hero background, manifesto quote block, ecosystem/big-banner cards, numbered process path, branded pricing cards, closing CTA banner) while keeping 100% of the existing SANDWICH copy, i18n strings, pricing data, FAQ content, and interactive behavior (hero prompt submit routing, language toggle, scroll-spy nav, mobile menu).

**Architecture:** Split the current single ~1020-line component into `LandingPage.tsx` (state, effects, composition) plus one component per section under `apps/web/src/components/landing/`. A shared `PromptPanel` component is used by both the hero and the new closing CTA banner so there's one source of truth for the prompt-submit interaction.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (utility classes + inline `style` for the dynamic color tokens, matching the codebase's existing pattern), `iconify-icon` web component for icons, existing `useAuth`/`useLanguage` hooks — no new npm dependencies.

## Global Constraints

- Do not change any copy, i18n keys, pricing data (`apps/web/src/lib/plans.ts`), FAQ data (`apps/web/src/lib/faqs.ts`), or routing/auth behavior. Only visual styling and file structure change.
- Do not invent new marketing claims, comparison content, or form fields not already in the codebase (per the approved design spec, the reference's "Us vs Them" section and multi-field "application form" are intentionally not built).
- Accent color: blue scale — primary `#3b82f6`, deep `#2554c7` (gradients/hover), replacing all uses of the current lime `#c6f91f` inside the landing page.
- Font: `'Inter', sans-serif` replacing `'Geist Variable', 'Inter', sans-serif` — landing-page-only change. Do not remove the global `@fontsource-variable/geist` import from `layout.tsx` (it's still used by `.ticket-description code` in `globals.css`, outside this page).
- Background video source path: `apps/web/public/videos/hero-background.webm` (already placed by the user). Must always have a non-broken visual fallback if the file is ever missing.
- Keep the existing dark background (`#05080A` / `#0B0F13` / `#0E1216`) — only the accent and font change, per the approved design.
- `npm --prefix apps/web run build` must succeed after every task that touches a `.tsx`/`.ts`/`.js`/`.css` file.

---

### Task 1: Design tokens — Inter font + blue accent, wider font-weight range

**Files:**
- Modify: `apps/web/src/app/layout.tsx:21`
- Modify: `apps/web/src/components/LandingPage.tsx:16-25` (will be superseded by Task 16, but this task establishes the token values every later task reads)

**Interfaces:**
- Produces: the constant names `FONT_SANS`, `ACCENT`, `ACCENT_DEEP`, `BG`, `PANEL`, `PANEL_2`, `BORDER`, `TEXT_PRIMARY`, `TEXT_SECONDARY`, `TEXT_MUTED` — every later landing-page component imports these from `apps/web/src/components/landing/tokens.ts` (created in this task).

- [ ] **Step 1: Widen the loaded Inter weight range**

In `apps/web/src/app/layout.tsx`, change the Google Fonts `<link>` (line 21) from:
```tsx
href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Bowlby+One&family=Mouse+Memoirs&display=swap"
```
to:
```tsx
href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Bowlby+One&family=Mouse+Memoirs&display=swap"
```
(adds weights 300 and 700, needed for the landing page's `font-light` headings and `font-semibold`/bold CTAs to render their real weight instead of being synthesized by the browser).

- [ ] **Step 2: Create the shared design-token module**

Create `apps/web/src/components/landing/tokens.ts`:
```ts
// Design tokens for the marketing landing page (apps/web/src/components/LandingPage.tsx
// and apps/web/src/components/landing/*). Blue accent + Inter, dark background.
export const FONT_SANS = "'Inter', sans-serif"
export const ACCENT = '#3b82f6'
export const ACCENT_DEEP = '#2554c7'
export const BG = '#05080A'
export const PANEL = '#0B0F13'
export const PANEL_2 = '#0E1216'
export const BORDER = 'rgba(255,255,255,0.1)'
export const TEXT_PRIMARY = '#ffffff'
export const TEXT_SECONDARY = 'rgba(255,255,255,0.7)'
export const TEXT_MUTED = 'rgba(255,255,255,0.45)'
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds (this task only adds a new unused-so-far file and a font link change, no behavior change yet).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/components/landing/tokens.ts
git commit -m "feat(web): add blue/Inter design tokens for landing page redesign"
```

---

### Task 2: `HeroBackgroundVideo` component

**Files:**
- Create: `apps/web/src/components/landing/HeroBackgroundVideo.tsx`

**Interfaces:**
- Produces: `export function HeroBackgroundVideo(): JSX.Element` — a full-bleed absolutely-positioned background layer, safe to render with zero props. Consumed by Task 5 (Hero).
- Consumes: `apps/web/public/videos/hero-background.webm` (already present).

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/HeroBackgroundVideo.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { ACCENT } from './tokens'

/**
 * Full-bleed animated background for the hero. Plays the provided WEBM loop;
 * if the video fails to load (missing file, unsupported format), falls back
 * to a static CSS aurora gradient so the hero never shows a broken element.
 */
export function HeroBackgroundVideo() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {!videoFailed && (
        <video
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="/videos/hero-background.webm" type="video/webm" />
        </video>
      )}
      {videoFailed && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 50% at 20% 10%, ${ACCENT}33, transparent 60%), radial-gradient(50% 40% at 80% 30%, ${ACCENT}22, transparent 60%)`,
          }}
        />
      )}
      {/* Dark scrim so foreground text stays legible over any footage/gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,8,10,0.55) 0%, rgba(5,8,10,0.85) 75%, #05080A 100%)' }} />
    </div>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds. The component isn't consumed anywhere yet, so this only checks it compiles — TypeScript will not error on an unused exported component.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/HeroBackgroundVideo.tsx
git commit -m "feat(web): add hero background video component with gradient fallback"
```

---

### Task 3: `PromptPanel` shared component (hero + closing CTA)

Extracts the existing "dashboard mockup" prompt box (lines 362-415 of the current `LandingPage.tsx`) into its own component so both the hero and the new closing CTA section (Task 13) render the exact same interactive element without duplicated state/logic.

**Files:**
- Create: `apps/web/src/components/landing/PromptPanel.tsx`

**Interfaces:**
- Produces: `export function PromptPanel(props: PromptPanelProps): JSX.Element`, where:
  ```ts
  interface PromptPanelProps {
    prompt: string
    setPrompt: (v: string) => void
    pendingType: string
    setPendingType: (v: string) => void
    isSubmitting: boolean
    error: string | null
    onSubmit: () => void
    onKeyDown: (e: React.KeyboardEvent) => void
    placeholder: string
    sendLabel: string
    className?: string
  }
  ```
  All state/handlers are owned by `LandingPage.tsx` (Task 16) and passed down — `PromptPanel` itself is stateless/controlled.
- Consumes: `DeliverableTypeSelect` from `apps/web/src/components/DeliverableTypeSelect.tsx` (existing, untouched — props `value: string`, `onChange: (v: string) => void`, confirmed in that file), and `ACCENT`, `PANEL`, `TEXT_PRIMARY`, `TEXT_MUTED` from `./tokens`.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/PromptPanel.tsx`:
```tsx
'use client'

import { DeliverableTypeSelect } from '../DeliverableTypeSelect'
import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface PromptPanelProps {
  prompt: string
  setPrompt: (v: string) => void
  pendingType: string
  setPendingType: (v: string) => void
  isSubmitting: boolean
  error: string | null
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
  sendLabel: string
  className?: string
}

export function PromptPanel({
  prompt,
  setPrompt,
  pendingType,
  setPendingType,
  isSubmitting,
  error,
  onSubmit,
  onKeyDown,
  placeholder,
  sendLabel,
  className = '',
}: PromptPanelProps) {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(11,15,19,0.8)',
          boxShadow: '0 25.7px 20.5px rgba(0,0,0,0.12), 0 85.8px 68.5px rgba(0,0,0,0.18)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}60, transparent)` }} />
        <div className="flex items-center gap-2 px-5 pt-4">
          <img src="/sandwich.webp" alt="" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-xs font-medium" style={{ color: TEXT_MUTED }}>sandwich.new</span>
        </div>
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none bg-transparent text-sm outline-none px-5 pt-3 pb-2 leading-relaxed placeholder:text-white/25"
          style={{ color: TEXT_PRIMARY }}
        />

        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <div className="flex items-center gap-1">
            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>⌘↵</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSubmit}
              disabled={isSubmitting || !prompt.trim()}
              aria-label={sendLabel}
              className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 active:scale-95"
              style={{ backgroundColor: ACCENT }}
            >
              {isSubmitting
                ? <iconify-icon icon="solar:refresh-linear" width="15" style={{ color: '#ffffff' }} className="animate-spin" />
                : <iconify-icon icon="solar:arrow-up-linear" width="15" style={{ color: '#ffffff' }} />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-center" style={{ color: '#ff6b6b' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds, no unused-import or type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/PromptPanel.tsx
git commit -m "feat(web): extract PromptPanel as a shared hero/CTA component"
```

---

### Task 4: `Nav` component (glass pill restyle)

**Files:**
- Create: `apps/web/src/components/landing/Nav.tsx`

**Interfaces:**
- Produces: `export function Nav(props: NavProps): JSX.Element`, where:
  ```ts
  interface NavProps {
    lang: 'en' | 'id'
    setLang: (l: 'en' | 'id') => void
    t: (key: import('../../lib/i18n').StringKey) => string
    activeSection: string
    onNavClick: (id: string) => void
    mobileNavOpen: boolean
    setMobileNavOpen: (v: boolean) => void
    onLogin: () => void
    onGetStarted: () => void
  }
  ```
- Consumes: `ACCENT`, `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`.

The current nav (lines 208-311 of `LandingPage.tsx`) already implements a rounded pill nav with backdrop blur — this task keeps that structural pattern (it already matches the reference's "glass pill nav" shape) and updates it to the reference's lighter glass treatment (`bg-white/5 border-white/10` instead of the near-opaque `rgba(5,8,10,0.9)`) plus the blue accent.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Nav.tsx`:
```tsx
'use client'

import type { StringKey } from '../../lib/i18n'
import { ACCENT, TEXT_PRIMARY } from './tokens'

export interface NavProps {
  navGetStarted: string
  navLogin: string
  navPipeline: string
  navHow: string
  navDiff: string
  navPricing: string
  navFaq: string
  navMenuOpen: string
  navMenuClose: string
  lang: 'en' | 'id'
  onToggleLang: () => void
  activeSection: string
  onNavClick: (id: string) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
  onLogin: () => void
  onGetStarted: () => void
}

const LINKS = (n: NavProps) => [
  { id: 'harnesses', label: n.navPipeline },
  { id: 'pipeline', label: n.navHow },
  { id: 'differentiators', label: n.navDiff },
  { id: 'pricing', label: n.navPricing },
  { id: 'faq', label: n.navFaq },
]

export function Nav(props: NavProps) {
  const { activeSection, onNavClick, mobileNavOpen, setMobileNavOpen, onLogin, onGetStarted } = props
  const links = LINKS(props)

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className="relative flex justify-center w-full">
        <nav
          className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-full border border-white/10 bg-white/5 max-w-full backdrop-blur-lg"
          style={{ boxShadow: '0 2px 24px rgba(0,0,0,0.35)' }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-1" style={{ backgroundColor: ACCENT }}>
            <span className="text-white font-bold text-[10px]">S</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => { e.preventDefault(); onNavClick(id) }}
                className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={{ color: activeSection === id ? ACCENT : 'rgba(255,255,255,0.6)', fontWeight: activeSection === id ? 600 : 500 }}
              >
                {label}
              </a>
            ))}
          </div>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
            aria-expanded={mobileNavOpen}
            className="md:hidden shrink-0 w-11 h-11 flex items-center justify-center rounded-full"
            style={{ color: TEXT_PRIMARY }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {mobileNavOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <button
            onClick={props.onToggleLang}
            className="shrink-0 px-4 min-w-[52px] min-h-11 flex items-center justify-center rounded-full text-xs font-semibold transition-colors bg-white/10"
            style={{ color: TEXT_PRIMARY }}
            title="Switch language"
          >
            {props.lang === 'en' ? 'EN' : 'ID'}
          </button>
          <button
            onClick={onLogin}
            className="shrink-0 px-3 sm:px-4 min-h-11 flex items-center rounded-full text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap border border-white/10 hover:text-white hover:border-white/30"
            style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)' }}
          >
            {props.navLogin}
          </button>
          <button
            onClick={onGetStarted}
            className="shrink-0 px-3 sm:px-4 min-h-11 flex items-center rounded-full text-xs sm:text-sm font-semibold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.navGetStarted}
          </button>
        </nav>
        {mobileNavOpen && (
          <div
            className="md:hidden absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 flex flex-col overflow-hidden backdrop-blur-lg bg-white/5"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => { e.preventDefault(); onNavClick(id); setMobileNavOpen(false) }}
                className="px-5 py-3.5 text-sm font-medium text-left border-b border-white/10 last:border-b-0"
                style={{ color: TEXT_PRIMARY }}
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Nav.tsx
git commit -m "feat(web): add glass-pill Nav component for landing page redesign"
```

---

### Task 5: `Hero` component (video background + reference typography)

**Files:**
- Create: `apps/web/src/components/landing/Hero.tsx`

**Interfaces:**
- Produces: `export function Hero(props: HeroProps): JSX.Element`, where:
  ```ts
  interface HeroProps {
    heroTagline: string
    navGetStarted: string
    navHow: string
    heroPromptPlaceholder: string
    heroSendLabel: string
    prompt: string
    setPrompt: (v: string) => void
    pendingType: string
    setPendingType: (v: string) => void
    isSubmitting: boolean
    error: string | null
    onSubmit: () => void
    onKeyDown: (e: React.KeyboardEvent) => void
  }
  ```
- Consumes: `HeroBackgroundVideo` (Task 2), `PromptPanel` (Task 3), tokens from `./tokens`.

Structural change from the current hero (lines 314-416): keep the same two-purpose layout (headline+CTA, prompt panel) but stack them in a single centered column over the video background (matching the reference's hero composition) instead of the current side-by-side bordered split, since a side-by-side split doesn't read well over a full-bleed video background.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Hero.tsx`:
```tsx
'use client'

import { HeroBackgroundVideo } from './HeroBackgroundVideo'
import { PromptPanel } from './PromptPanel'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface HeroProps {
  heroTagline: string
  navGetStarted: string
  navHow: string
  heroPromptPlaceholder: string
  heroSendLabel: string
  prompt: string
  setPrompt: (v: string) => void
  pendingType: string
  setPendingType: (v: string) => void
  isSubmitting: boolean
  error: string | null
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function Hero(props: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-40 pb-24 md:pt-56 md:pb-32">
      <HeroBackgroundVideo />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT }} />
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.heroTagline}</p>
        </div>

        <h1
          className="text-5xl sm:text-6xl lg:text-7xl leading-[1.05] font-light tracking-tighter"
          style={{ color: TEXT_PRIMARY }}
        >
          SANDWICH
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mt-6 font-light" style={{ color: TEXT_SECONDARY }}>
          {props.heroTagline}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={props.onSubmit}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.35)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.navGetStarted}
          </button>
          <button
            onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 hover:bg-white/10 text-sm font-medium bg-white/5 border border-white/10 rounded-full px-8 py-3.5 backdrop-blur transition-colors"
            style={{ color: TEXT_PRIMARY }}
          >
            {props.navHow}
          </button>
        </div>

        <div className="mt-14 w-full flex justify-center">
          <PromptPanel
            prompt={props.prompt}
            setPrompt={props.setPrompt}
            pendingType={props.pendingType}
            setPendingType={props.setPendingType}
            isSubmitting={props.isSubmitting}
            error={props.error}
            onSubmit={props.onSubmit}
            onKeyDown={props.onKeyDown}
            placeholder={props.heroPromptPlaceholder}
            sendLabel={props.heroSendLabel}
          />
        </div>
      </div>
    </section>
  )
}
```

Note: the hero's primary CTA button now calls `props.onSubmit` directly (submitting whatever is currently in the prompt textarea) rather than the original's `document.querySelector('textarea')?.focus()` — this matches the reference's hero CTA acting as the actual submit action. If the prompt is empty, `handleSubmit` in `LandingPage.tsx` (Task 16) already no-ops (`if (!prompt.trim()) return`), so clicking with an empty box is a safe no-op, same as before.

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Hero.tsx
git commit -m "feat(web): add redesigned Hero component with video background"
```

---

### Task 6: `FormatMarquee` component

**Files:**
- Create: `apps/web/src/components/landing/FormatMarquee.tsx`

**Interfaces:**
- Produces: `export function FormatMarquee(props: { label: string }): JSX.Element`.
- Consumes: `TEXT_MUTED`, `TEXT_PRIMARY`, `BORDER` from `./tokens`.

Directly ports the existing marquee strip (lines 418-439), only restyling border/background to the lighter glass treatment (`border-white/10` instead of the dashed `sw-dashed` class, which this redesign retires in favor of Tailwind's `border-white/10` utility used throughout the reference).

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/FormatMarquee.tsx`:
```tsx
'use client'

import { TEXT_MUTED, TEXT_PRIMARY } from './tokens'

const FORMATS = ['PRD', 'SPECS', 'PROTOTYPE', 'QUOTATION', 'MOM']

export function FormatMarquee({ label }: { label: string }) {
  return (
    <div className="relative z-10 grid grid-cols-12 border-b border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="col-span-12 md:col-span-2 py-6 px-6 md:px-10 border-b md:border-b-0 md:border-r border-white/10 flex items-center">
        <span className="text-xs font-medium tracking-widest uppercase" style={{ color: TEXT_MUTED }}>{label}</span>
      </div>
      <div
        className="col-span-12 md:col-span-10 relative overflow-hidden h-16 flex items-center"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
      >
        <div className="flex w-max sw-marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0">
              {FORMATS.map((f) => (
                <div key={f} className="w-40 h-16 flex-shrink-0 flex items-center justify-center border-r border-white/10 opacity-50 hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium tracking-tighter" style={{ color: TEXT_PRIMARY }}>{f}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

The `sw-marquee-track` class (the `@keyframes sw-marquee` animation) stays defined in `LandingPage.tsx`'s global `<style>` block (Task 16) since it's a page-level animation utility, not component-scoped.

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/FormatMarquee.tsx
git commit -m "feat(web): add FormatMarquee component"
```

---

### Task 7: `Harnesses` component (manifesto quote-block treatment)

**Files:**
- Create: `apps/web/src/components/landing/Harnesses.tsx`

**Interfaces:**
- Produces: `export function Harnesses(props: HarnessesProps): JSX.Element`, where:
  ```ts
  interface HarnessesProps {
    kicker: string
    title: string
    desc: string
    reveal: (id: string, extra?: string) => string
    rightWriteSpec: string
    rightStructureBrief: string
    rightQuotation: string
  }
  ```
- Consumes: `ACCENT`, `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`. `reveal` is the existing scroll-reveal className helper (still owned/computed by `LandingPage.tsx`, passed down — see Task 16).

Restyle direction: wrap the existing three-column layout (left icon list / center illustration / right icon list, lines 441-511) inside a bordered rounded panel with a large quote-mark icon in the corner, echoing the reference's manifesto block (`bg-neutral-900/50 border border-white/10 rounded-2xl p-8 sm:p-12` with a `solar:quote-left-bold` icon), since "Messy input. Clean spec." reads naturally as the product's manifesto statement.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Harnesses.tsx`:
```tsx
'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface HarnessesProps {
  kicker: string
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
  rightWriteSpec: string
  rightStructureBrief: string
  rightQuotation: string
}

export function Harnesses(props: HarnessesProps) {
  return (
    <section id="harnesses" className="py-24 md:py-32 relative overflow-hidden border-t border-white/5 bg-white/[0.02] scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 relative">
        <div id="harnesses-head" className={props.reveal('harnesses-head', 'text-center mb-12')}>
          <p className="text-xs font-semibold tracking-wider uppercase font-mono" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-neutral-900/40 p-8 sm:p-12">
          <iconify-icon icon="solar:quote-left-bold" width="32" className="absolute top-6 left-6 opacity-20" style={{ color: TEXT_PRIMARY }} />
          <p className="relative text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: TEXT_SECONDARY }}>
            {props.desc}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 text-xs uppercase tracking-tight font-medium" style={{ color: TEXT_PRIMARY }}>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:document-text-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>PRD</span>
            </div>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:notes-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>Specs</span>
            </div>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:widget-2-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>Prototype</span>
            </div>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:pen-new-square-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>{props.rightWriteSpec}</span>
            </div>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:list-check-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>{props.rightStructureBrief}</span>
            </div>
            <div className="flex items-center gap-3">
              <iconify-icon icon="solar:money-bag-linear" className="text-xl" style={{ color: ACCENT }} />
              <span>{props.rightQuotation}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

Note: the center spec-illustration image (`/spec-illustration.{avif,webp,png}`) is dropped from this section in favor of the quote-block treatment — the six labels (PRD/Specs/Prototype/Write Spec/Structure the Brief/Quotation) are preserved as a single row beneath the quote instead of two flanking columns around the image, since the image doesn't fit the manifesto-block pattern. This is a visual-only change; no copy is lost.

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Harnesses.tsx
git commit -m "feat(web): add Harnesses manifesto-block component"
```

---

### Task 8: `Pipeline` component (numbered circles + connecting line)

**Files:**
- Create: `apps/web/src/components/landing/Pipeline.tsx`

**Interfaces:**
- Produces: `export function Pipeline(props: PipelineProps): JSX.Element`, where:
  ```ts
  interface PipelineProps {
    kicker: string
    titleL1: string
    titleL2: string
    cta: string
    onCtaClick: () => void
    reveal: (id: string, extra?: string) => string
    steps: { n: string; icon: string; title: string; desc: string }[]
  }
  ```
- Consumes: `ACCENT`, `PANEL`, `TEXT_PRIMARY`, `TEXT_MUTED` from `./tokens`.

Restyle direction: replace the current bento-grid step cards (lines 526-553) with the reference's "Process Path" pattern — a horizontal row of numbered circles connected by a line (`md:grid-cols-4` since SANDWICH has 4 steps vs. the reference's 3), each with title+description below the circle.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Pipeline.tsx`:
```tsx
'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface PipelineStep {
  n: string
  icon: string
  title: string
  desc: string
}

export interface PipelineProps {
  kicker: string
  titleL1: string
  titleL2: string
  cta: string
  onCtaClick: () => void
  reveal: (id: string, extra?: string) => string
  steps: PipelineStep[]
}

export function Pipeline(props: PipelineProps) {
  return (
    <section id="pipeline" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <div id="pipeline-head" className={props.reveal('pipeline-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>
            {props.titleL1} {props.titleL2}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          {props.steps.map((step) => (
            <div key={step.n} className="relative flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center relative z-10 mb-5 border border-white/15"
                style={{ backgroundColor: PANEL, boxShadow: `0 0 20px -6px ${ACCENT}55` }}
              >
                <iconify-icon icon={step.icon} width="22" style={{ color: ACCENT }} />
              </div>
              <p className="font-medium text-base tracking-tight mb-2" style={{ color: TEXT_PRIMARY }}>{step.title}</p>
              <p className="text-sm leading-relaxed max-w-[220px]" style={{ color: TEXT_MUTED }}>{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <button
            onClick={props.onCtaClick}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.3)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.cta}
            <iconify-icon icon="solar:arrow-right-up-linear" />
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Pipeline.tsx
git commit -m "feat(web): add Pipeline numbered-steps component"
```

---

### Task 9: `Ingredients` component

**Files:**
- Create: `apps/web/src/components/landing/Ingredients.tsx`

**Interfaces:**
- Produces: `export function Ingredients(props: IngredientsProps): JSX.Element`, where:
  ```ts
  interface IngredientsProps {
    kicker: string
    title: string
    desc: string
    reveal: (id: string, extra?: string) => string
    items: { img: string; name: string; desc: string }[]
  }
  ```
- Consumes: `ACCENT`, `TEXT_PRIMARY`, `TEXT_MUTED` from `./tokens`.

Restyle direction: convert the current staggered image-icon layout (lines 568-605) into the reference's small-card grid (`rounded-2xl border border-white/10 bg-white/5` cards), matching the "Ecosystem" 3-card pattern extended to 4 cards.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Ingredients.tsx`:
```tsx
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Ingredients.tsx
git commit -m "feat(web): add Ingredients card-grid component"
```

---

### Task 10: `SampleOutputsBanner` component (stacked big-feature banners)

**Files:**
- Create: `apps/web/src/components/landing/SampleOutputsBanner.tsx`

**Interfaces:**
- Produces: `export function SampleOutputsBanner(props: SampleOutputsBannerProps): JSX.Element`.
- Consumes: `ACCENT`, `PANEL`, `TEXT_PRIMARY`, `TEXT_SECONDARY`, `TEXT_MUTED`, `BORDER` from `./tokens`.

Restyle direction: keep all four samples' data exactly as-is (`PRD_SAMPLE`, `QUOTATION_SAMPLE`, `SPECS_SAMPLE`, `PROTOTYPE_SAMPLE`, lines 27-69 of the current file — moved into this new file unchanged), but render each as its own full-width "big feature" banner (matching the reference's ecosystem banner: a bordered rounded panel with a badge/label and a code-window mockup), stacked vertically, instead of the current 2x2 small-card grid.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/SampleOutputsBanner.tsx`:
```tsx
'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

const PRD_SAMPLE = {
  project: 'Padel court booking platform',
  heading: 'Business Requirements',
  rows: [
    { req: 'Multi-location support', detail: 'Manage courts across multiple venues from one dashboard' },
    { req: 'Phase 1: third-party booking API', detail: 'Use existing platform for availability + exposure' },
    { req: 'Custom payment UI', detail: 'In-page checkout, no redirect to reduce drop-off' },
    { req: 'Fraud / double-booking prevention', detail: 'Lock slot on payment start, auto-release after 10 min' },
  ],
}

const QUOTATION_SAMPLE = {
  project: 'Fleet management portal',
  heading: 'Scope & Pricing',
  items: [
    { module: 'Vehicle tracking dashboard', days: 8, price: 'Rp 12.000.000' },
    { module: 'Driver assignment flow', days: 5, price: 'Rp 7.500.000' },
    { module: 'Maintenance scheduling', days: 4, price: 'Rp 6.000.000' },
  ],
  assumptions: 'Client provides GPS API access.',
  terms: '50% upfront, 50% on delivery.',
}

const SPECS_SAMPLE = {
  project: 'Housekeeping ops app',
  feature: 'Room status sync',
  scope: 'Housekeeper marks room clean/dirty from mobile; front desk sees live status.',
  criteria: [
    'Status updates reflect in front desk view within 5s',
    'Offline updates queue and sync on reconnect',
    'Only assigned housekeeper can update their rooms',
  ],
}

const PROTOTYPE_SAMPLE = {
  project: 'Restaurant table reservation',
  file: 'dashboard.html',
  slots: [
    { time: '19:00', status: 'available' },
    { time: '19:30', status: 'booked' },
    { time: '20:00', status: 'available' },
  ],
}

function BannerFrame({ badge, project, file, children }: { badge: string; project: string; file: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>{badge}</span>
        <span className="text-xs" style={{ color: TEXT_MUTED }}>{project}</span>
      </div>
      <div className="rounded-lg overflow-hidden border border-white/10" style={{ backgroundColor: PANEL_2 }}>
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          <span className="ml-2 text-[11px] font-mono" style={{ color: TEXT_MUTED }}>{file}</span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export interface SampleOutputsBannerProps {
  kicker: string
  titleL1: string
  titleL2: string
  desc: string
  reveal: (id: string, extra?: string) => string
}

export function SampleOutputsBanner(props: SampleOutputsBannerProps) {
  return (
    <section id="samples" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6">
        <div id="samples-head" className={props.reveal('samples-head', 'mb-12 text-center')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight mb-4" style={{ color: TEXT_PRIMARY }}>
            {props.titleL1} {props.titleL2}
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <div className="flex flex-col gap-6">
          <BannerFrame badge="PRD" project={PRD_SAMPLE.project} file="prd.md">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>{PRD_SAMPLE.heading}</p>
            <div className="rounded-lg overflow-hidden border border-white/10">
              {PRD_SAMPLE.rows.map((row, i) => (
                <div key={row.req} className={`px-3.5 py-3 ${i !== 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                  <p className="text-xs font-semibold tracking-tight" style={{ color: TEXT_PRIMARY }}>{row.req}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT_MUTED }}>{row.detail}</p>
                </div>
              ))}
            </div>
          </BannerFrame>

          <BannerFrame badge="Quotation" project={QUOTATION_SAMPLE.project} file="quotation.md">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>{QUOTATION_SAMPLE.heading}</p>
            <div className="rounded-lg overflow-hidden border border-white/10">
              {QUOTATION_SAMPLE.items.map((item, i) => (
                <div key={item.module} className={`flex items-center justify-between gap-3 px-3.5 py-3 ${i !== 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                  <div>
                    <p className="text-xs font-semibold tracking-tight" style={{ color: TEXT_PRIMARY }}>{item.module}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>{item.days} days</p>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: ACCENT }}>{item.price}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: TEXT_MUTED }}><span className="font-semibold" style={{ color: TEXT_SECONDARY }}>Assumptions:</span> {QUOTATION_SAMPLE.assumptions}</p>
            <p className="text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}><span className="font-semibold" style={{ color: TEXT_SECONDARY }}>Terms:</span> {QUOTATION_SAMPLE.terms}</p>
          </BannerFrame>

          <BannerFrame badge="Specs" project={SPECS_SAMPLE.project} file="specs.md">
            <p className="text-sm font-semibold tracking-tight mb-1" style={{ color: TEXT_PRIMARY }}>{SPECS_SAMPLE.feature}</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: TEXT_MUTED }}>{SPECS_SAMPLE.scope}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>Acceptance criteria</p>
            <div className="flex flex-col gap-2">
              {SPECS_SAMPLE.criteria.map((c) => (
                <div key={c} className="flex items-start gap-2">
                  <iconify-icon icon="solar:check-circle-bold" width="15" style={{ color: ACCENT, flexShrink: 0, marginTop: '1px' }} />
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>{c}</p>
                </div>
              ))}
            </div>
          </BannerFrame>

          <BannerFrame badge="Prototype" project={PROTOTYPE_SAMPLE.project} file={PROTOTYPE_SAMPLE.file}>
            <div className="flex gap-2">
              {PROTOTYPE_SAMPLE.slots.map((slot) => (
                <div
                  key={slot.time}
                  className="flex-1 text-center rounded-lg py-2.5 text-xs font-semibold tracking-tight"
                  style={slot.status === 'booked' ? { backgroundColor: ACCENT, color: '#ffffff' } : { backgroundColor: 'rgba(255,255,255,0.05)', color: TEXT_PRIMARY }}
                >
                  {slot.time}
                </div>
              ))}
            </div>
          </BannerFrame>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/SampleOutputsBanner.tsx
git commit -m "feat(web): add SampleOutputsBanner stacked-banner component"
```

---

### Task 11: `Differentiators` component

**Files:**
- Create: `apps/web/src/components/landing/Differentiators.tsx`

**Interfaces:**
- Produces: `export function Differentiators(props: DifferentiatorsProps): JSX.Element`, where:
  ```ts
  interface DifferentiatorsProps {
    kicker: string
    title: string
    reveal: (id: string, extra?: string) => string
    items: { icon: string; title: string; desc: string; highlight: boolean }[]
  }
  ```
- Consumes: `ACCENT`, `PANEL`, `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`.

Direct restyle of the existing 2x2 grid (lines 731-775): switch the highlighted card's gradient from lime to blue and swap the dashed borders for solid `border-white/10`/`border-blue-500/30`, matching the reference's "Us" card treatment (`border-blue-500/30 bg-blue-900/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.2)]`) reused here for the single highlighted differentiator instead of a two-column comparison.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Differentiators.tsx`:
```tsx
'use client'

import { ACCENT, PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface DifferentiatorItem {
  icon: string
  title: string
  desc: string
  highlight: boolean
}

export interface DifferentiatorsProps {
  kicker: string
  title: string
  reveal: (id: string, extra?: string) => string
  items: DifferentiatorItem[]
}

export function Differentiators(props: DifferentiatorsProps) {
  return (
    <section id="differentiators" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <div id="diff-head" className={props.reveal('diff-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-3xl md:text-5xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {props.items.map((d) => (
            <div
              key={d.title}
              className={`p-8 min-h-[240px] rounded-2xl border flex flex-col justify-between transition-colors duration-300 ${
                d.highlight ? 'border-blue-500/30 bg-blue-900/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]' : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
              }`}
              style={!d.highlight ? { backgroundColor: PANEL } : undefined}
            >
              <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: d.highlight ? `${ACCENT}26` : 'rgba(255,255,255,0.05)' }}>
                <iconify-icon icon={d.icon} width="24" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="font-medium text-lg tracking-tight mb-2" style={{ color: TEXT_PRIMARY }}>{d.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Differentiators.tsx
git commit -m "feat(web): add Differentiators card-grid component"
```

---

### Task 12: `Pricing` component (branded cards)

**Files:**
- Create: `apps/web/src/components/landing/Pricing.tsx`

**Interfaces:**
- Produces: `export function Pricing(props: PricingProps): JSX.Element`, where:
  ```ts
  interface PricingProps {
    kicker: string
    titleL1: string
    titleL2: string
    desc: string
    bestValue: string
    reveal: (id: string, extra?: string) => string
    plans: {
      slug: string
      name: string
      price: string
      priceNote: string
      oldPrice: string | null
      desc: string
      features: string[]
      cta: string
      highlight: boolean
    }[]
    onSelectPlan: (slug: string) => void
  }
  ```
- Consumes: `ACCENT`, `PANEL`, `TEXT_PRIMARY`, `TEXT_SECONDARY`, `TEXT_MUTED` from `./tokens`. Plan data itself still comes from `PLANS_META` in `LandingPage.tsx` (Task 16) — this component only renders whatever `plans` array it's given, unchanged data shape from the current `PLANS` mapping (lines 80-90).

Direct restyle of the existing pricing cards (lines 802-856): reference's card treatment (bigger price, feature checklist with blue checks, "Best value" badge, solid blue CTA on the highlighted plan) — the current implementation already matches this pattern closely, so this is mostly a color/border swap plus adopting `rounded-2xl` and `border-white/10`/`bg-white/5`.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Pricing.tsx`:
```tsx
'use client'

import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

export interface PricingPlan {
  slug: string
  name: string
  price: string
  priceNote: string
  oldPrice: string | null
  desc: string
  features: string[]
  cta: string
  highlight: boolean
}

export interface PricingProps {
  kicker: string
  titleL1: string
  titleL2: string
  desc: string
  bestValue: string
  reveal: (id: string, extra?: string) => string
  plans: PricingPlan[]
  onSelectPlan: (slug: string) => void
}

export function Pricing(props: PricingProps) {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden border-t border-white/5 scroll-mt-24">
      <div
        className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none"
        style={{ background: `radial-gradient(600px circle at top center, ${ACCENT}14, transparent 60%)` }}
      />
      <div className="max-w-4xl mx-auto px-6 relative">
        <div id="pricing-head" className={props.reveal('pricing-head', 'mb-12 text-center')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-5xl font-light tracking-tighter mb-6 leading-tight" style={{ color: TEXT_PRIMARY }}>
            {props.titleL1}<br />{props.titleL2}
          </h2>
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {props.plans.map((plan) => (
            <div
              key={plan.slug}
              className={`flex flex-col rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform duration-300 border backdrop-blur-xl ${
                plan.highlight ? 'border-blue-500/30 bg-blue-900/10 shadow-[0_0_30px_-5px_rgba(59,130,246,0.2)]' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-lg font-medium" style={{ color: TEXT_PRIMARY }}>{plan.name}</span>
                  {plan.highlight && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full text-blue-950 bg-blue-400">{props.bestValue}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 flex-wrap mb-1">
                  <span className="font-light" style={{ fontSize: '2.5rem', lineHeight: 1, color: TEXT_PRIMARY }}>{plan.price}</span>
                  <span className="text-sm ml-1" style={{ color: TEXT_MUTED }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: 'rgba(255,255,255,0.25)' }}>{plan.oldPrice}</span>}
                </div>
                <p className="text-sm" style={{ color: TEXT_SECONDARY }}>{plan.desc}</p>
              </div>

              <div className="px-6 pb-5">
                <button
                  onClick={() => props.onSelectPlan(plan.slug)}
                  className={`w-full py-3 rounded-full text-sm font-semibold transition-all ${
                    plan.highlight ? 'shadow-[0_0_30px_rgba(59,130,246,0.3)]' : ''
                  }`}
                  style={plan.highlight ? { backgroundColor: ACCENT, color: '#ffffff' } : { backgroundColor: 'rgba(255,255,255,0.08)', color: TEXT_PRIMARY }}
                >
                  {plan.cta}
                </button>
              </div>

              <ul className="flex flex-col gap-3 px-6 py-5 flex-1 border-t border-white/10">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: TEXT_SECONDARY }}>
                    <iconify-icon icon="solar:check-circle-linear" width="15" style={{ color: ACCENT, flexShrink: 0, marginTop: '2px' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Pricing.tsx
git commit -m "feat(web): add branded Pricing card component"
```

---

### Task 13: `FinalCta` component (closing CTA banner, reuses `PromptPanel`)

**Files:**
- Create: `apps/web/src/components/landing/FinalCta.tsx`

**Interfaces:**
- Produces: `export function FinalCta(props: FinalCtaProps): JSX.Element`, where `FinalCtaProps` is identical in shape to `PromptPanelProps` (Task 3) plus `{ title: string; desc: string; reveal: (id: string, extra?: string) => string }`.
- Consumes: `PromptPanel` (Task 3), `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`.

This is the reference's "Application" section reskinned per the approved design: same dark-overlay full-width band, same header treatment, but instead of a 5-field lead form it renders the identical `PromptPanel` used in the hero — same state, same submit behavior, just presented again as the page's closing CTA (a common pattern: repeat the primary action at the bottom of a long page).

Copy decision (no new strings): none of the existing `*_kicker` i18n strings (`harnesses_kicker`, `pipeline_kicker`, `stack_kicker`, `pricing_kicker`, `samples_kicker`, `diff_kicker`, `faq_kicker`) read naturally as a "get started" eyebrow, so this component has **no kicker badge** — just `title` (wired to `nav_get_started`, "Start from your brief" / "Mulai dari brief") and `desc` (wired to `hero_tagline`) in Task 16.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/FinalCta.tsx`:
```tsx
'use client'

import { PromptPanel, type PromptPanelProps } from './PromptPanel'
import { TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FinalCtaProps extends PromptPanelProps {
  title: string
  desc: string
  reveal: (id: string, extra?: string) => string
}

export function FinalCta(props: FinalCtaProps) {
  return (
    <section className="relative overflow-hidden py-24 border-t border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 max-w-2xl mx-auto px-6">
        <div id="final-cta-head" className={props.reveal('final-cta-head', 'text-center mb-10')}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
          <p className="mt-4 text-base" style={{ color: TEXT_SECONDARY }}>{props.desc}</p>
        </div>

        <div className="flex justify-center">
          <PromptPanel
            prompt={props.prompt}
            setPrompt={props.setPrompt}
            pendingType={props.pendingType}
            setPendingType={props.setPendingType}
            isSubmitting={props.isSubmitting}
            error={props.error}
            onSubmit={props.onSubmit}
            onKeyDown={props.onKeyDown}
            placeholder={props.placeholder}
            sendLabel={props.sendLabel}
          />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/FinalCta.tsx
git commit -m "feat(web): add FinalCta closing banner component"
```

---

### Task 14: `Faq` component

**Files:**
- Create: `apps/web/src/components/landing/Faq.tsx`

**Interfaces:**
- Produces: `export function Faq(props: FaqProps): JSX.Element`, where:
  ```ts
  interface FaqProps {
    kicker: string
    title: string
    cta: string
    onCtaClick: () => void
    reveal: (id: string, extra?: string) => string
    lang: 'en' | 'id'
    openFaq: number | null
    setOpenFaq: (i: number | null) => void
  }
  ```
- Consumes: `FAQS` from `../../lib/faqs` (existing, untouched — shape confirmed as `{ q: {en,id}, a: {en,id} }[]`), `ACCENT`, `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`.

Direct restyle of the existing accordion (lines 860-907): replace dashed dividers with solid `divide-white/10`, keep the exact same `<details>`/`<summary>` interaction pattern.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Faq.tsx`:
```tsx
'use client'

import { FAQS } from '../../lib/faqs'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FaqProps {
  kicker: string
  title: string
  cta: string
  onCtaClick: () => void
  reveal: (id: string, extra?: string) => string
  lang: 'en' | 'id'
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
}

export function Faq(props: FaqProps) {
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-white/5 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-6">
        <div id="faq-head" className={props.reveal('faq-head', 'text-center mb-16')}>
          <p className="font-mono text-xs tracking-widest uppercase" style={{ color: ACCENT }}>{props.kicker}</p>
          <h2 className="mt-4 text-4xl md:text-6xl font-light tracking-tighter leading-tight" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
        </div>

        <div className="flex flex-col divide-y divide-white/10">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group py-6"
              open={props.openFaq === i}
              onClick={(e) => { e.preventDefault(); props.setOpenFaq(props.openFaq === i ? null : i) }}
            >
              <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                <span className="text-base font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>{faq.q[props.lang]}</span>
                <iconify-icon
                  icon="solar:alt-arrow-down-linear"
                  className={`text-xl shrink-0 transition-transform duration-300 ${props.openFaq === i ? 'rotate-180' : ''}`}
                  style={{ color: ACCENT }}
                />
              </summary>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{faq.a[props.lang]}</p>
            </details>
          ))}
        </div>

        <div className="mt-14 text-center">
          <button
            onClick={props.onCtaClick}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(59,130,246,0.25)]"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            {props.cta}
            <iconify-icon icon="solar:arrow-right-up-linear" />
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Faq.tsx
git commit -m "feat(web): add Faq accordion component"
```

---

### Task 15: `Footer` component

**Files:**
- Create: `apps/web/src/components/landing/Footer.tsx`

**Interfaces:**
- Produces: `export function Footer(props: FooterProps): JSX.Element`, where:
  ```ts
  interface FooterProps {
    navPipeline: string
    navHow: string
    navPricing: string
    navFaq: string
    footerDesc: string
    footerProduct: string
    footerLegal: string
    footerPrivacy: string
    footerTerms: string
    footerRefund: string
    footerContact: string
    footerProductBy: string
    onNavClick: (id: string) => void
  }
  ```
- Consumes: `ACCENT`, `TEXT_PRIMARY`, `TEXT_SECONDARY` from `./tokens`, `Link` from `next/link`.

Direct restyle of the existing footer (lines 910-1017): swap dashed borders for solid `border-white/10`, lime hover color for blue, otherwise identical structure/links/copy.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/landing/Footer.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FooterProps {
  navPipeline: string
  navHow: string
  navPricing: string
  navFaq: string
  footerDesc: string
  footerProduct: string
  footerLegal: string
  footerPrivacy: string
  footerTerms: string
  footerRefund: string
  footerContact: string
  footerProductBy: string
  onNavClick: (id: string) => void
}

export function Footer(props: FooterProps) {
  return (
    <footer className="border-t border-white/10 pt-16 pb-10" style={{ color: TEXT_PRIMARY }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-12 md:gap-20 pb-12 border-b border-white/10">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="text-base font-medium tracking-tight uppercase">SANDWICH</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{props.footerDesc}</p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { icon: 'mdi:instagram', href: 'https://www.instagram.com/etalas.id/', label: 'Instagram' },
                { icon: 'mdi:linkedin', href: 'https://www.linkedin.com/company/etalas/', label: 'LinkedIn' },
              ].map(({ icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 border border-white/10"
                  style={{ color: TEXT_SECONDARY }}
                  aria-label={label}
                >
                  <iconify-icon icon={icon} width="15" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-10 flex-1 justify-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{props.footerProduct}</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: props.navPipeline, id: 'harnesses' },
                  { label: props.navHow, id: 'pipeline' },
                  { label: props.navPricing, id: 'pricing' },
                  { label: props.navFaq, id: 'faq' },
                ].map(({ label, id }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => { e.preventDefault(); props.onNavClick(id) }}
                      className="text-sm transition-colors font-medium hover:text-blue-400"
                      style={{ color: TEXT_SECONDARY }}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Sandwich</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Website', href: 'https://etalas.com' },
                  { label: 'Instagram', href: 'https://www.instagram.com/etalas.id/' },
                  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/etalas/' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer" className="text-sm transition-colors font-medium hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{props.footerLegal}</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: props.footerPrivacy, href: '/privacy' },
                  { label: props.footerTerms, href: '/terms' },
                  { label: props.footerRefund, href: '/refund' },
                  { label: props.footerContact, href: '/contact' },
                ].map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm transition-colors font-medium hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-8">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>© 2026 SANDWICH</p>
          <a href="https://www.etalas.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>
            <span className="text-sm">{props.footerProductBy}</span>
            <img src="/logos/etalas-logo.png" alt="Etalas" loading="lazy" className="h-4 w-auto brightness-0 invert" />
          </a>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Footer.tsx
git commit -m "feat(web): add Footer component"
```

---

### Task 16: Reassemble `LandingPage.tsx`

**Files:**
- Modify: `apps/web/src/components/LandingPage.tsx` (full rewrite of the file, keeping only state/effects/data-wiring — all JSX moves into the Task 4-15 components)

**Interfaces:**
- Consumes every component/prop-shape produced by Tasks 1-15.
- Produces: `export default function LandingPage(): JSX.Element` (unchanged export signature — `apps/web/src/app/page.tsx` imports this by default export, no change needed there).

- [ ] **Step 1: Rewrite `LandingPage.tsx`**

Replace the entire contents of `apps/web/src/components/LandingPage.tsx` with:
```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createConversationLocal } from '../lib/conversations'
import { createMessage } from '../api/conversations'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../lib/i18n'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { FormatMarquee } from './landing/FormatMarquee'
import { Harnesses } from './landing/Harnesses'
import { Pipeline } from './landing/Pipeline'
import { Ingredients } from './landing/Ingredients'
import { SampleOutputsBanner } from './landing/SampleOutputsBanner'
import { Differentiators } from './landing/Differentiators'
import { Pricing } from './landing/Pricing'
import { FinalCta } from './landing/FinalCta'
import { Faq } from './landing/Faq'
import { Footer } from './landing/Footer'
import { FONT_SANS, BG } from './landing/tokens'

const REVEAL_IDS = [
  'harnesses-head', 'pipeline-head', 'about-head', 'samples-head', 'diff-head', 'pricing-head', 'faq-head', 'final-cta-head',
]

export default function LandingPage() {
  const { lang, setLang, t } = useLanguage()
  const { state: authState } = useAuth()
  const router = useRouter()
  const PLANS = PLANS_META.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    priceNote: p.amount === 0 ? '' : `/ ${lang === 'id' ? 'bulan' : 'mo'}`,
    desc: t(p.descKey),
    features: p.featureKeys.map((k) => t(k)),
    cta: t(p.ctaKey),
    highlight: p.highlight,
    oldPrice: p.oldPrice,
  }))

  const [prompt, setPrompt] = useState('')
  const [pendingType, setPendingType] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const activeSectionRef = useRef<string>('')
  const [activeSectionState, setActiveSectionState] = useState<string>('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (window.location.hash === '#pricing') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const ids = ['harnesses', 'pipeline', 'differentiators', 'pricing', 'faq']
    const observers = ids.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            activeSectionRef.current = id
            setActiveSectionState(id)
          }
        },
        { rootMargin: '-96px 0px -70% 0px', threshold: 0 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  useEffect(() => {
    const observers = REVEAL_IDS.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setRevealed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  const reveal = (id: string, extra = '') => `reveal-on-scroll ${revealed.has(id) ? 'is-visible' : ''} ${extra}`

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    if (authState.status !== 'authenticated') {
      try {
        localStorage.setItem('sandwich_draft', JSON.stringify({ prompt, activeType: pendingType || undefined }))
      } catch { /* best-effort draft save, e.g. storage quota */ }
      router.push('/register')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const local = await createConversationLocal({ type: 'general', pendingType: pendingType || undefined, summary: prompt.trim(), description: prompt.trim() })
      await createMessage(local.id, { content: prompt.trim() })
      try {
        localStorage.setItem('sandwich_last_chat', JSON.stringify({ prompt: prompt.trim(), conversationId: local.id, autoRun: true }))
      } catch { /* ignore storage errors */ }
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'active subscription required') {
        try { localStorage.setItem('sandwich_draft', JSON.stringify({ prompt, activeType: pendingType || undefined })) } catch { /* ignore */ }
        router.push('/pay?plan=pro')
        return
      }
      setError(msg || t('hero_error_generic'))
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const scrollToSection = (id: string) => {
    activeSectionRef.current = id
    setActiveSectionState(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const ingredientItems = [
    { img: '/ingredients/tomato.webp', name: 'PRD', desc: t('stack_order_desc') },
    { img: '/ingredients/cheese.webp', name: 'Prototype', desc: t('stack_prep_desc') },
    { img: '/ingredients/meat.webp', name: 'Quotation', desc: t('stack_recipe_desc') },
    { img: '/ingredients/lettuce.webp', name: 'Specs', desc: t('stack_validate_desc') },
  ]

  const pipelineSteps = [
    { n: '01', icon: 'solar:clipboard-text-linear', title: t('pipeline_step_1_title'), desc: t('pipeline_step_1_desc') },
    { n: '02', icon: 'solar:widget-2-linear', title: t('pipeline_step_2_title'), desc: t('pipeline_step_2_desc') },
    { n: '03', icon: 'solar:question-circle-linear', title: t('pipeline_step_3_title'), desc: t('pipeline_step_3_desc') },
    { n: '04', icon: 'solar:share-linear', title: t('pipeline_step_4_title'), desc: t('pipeline_step_4_desc') },
  ]

  const differentiatorItems = [
    { icon: 'solar:history-linear', title: t('diff_1_title'), desc: t('diff_1_desc'), highlight: false },
    { icon: 'solar:cloud-check-linear', title: t('diff_2_title'), desc: t('diff_2_desc'), highlight: true },
    { icon: 'solar:link-round-linear', title: t('diff_3_title'), desc: t('diff_3_desc'), highlight: false },
    { icon: 'solar:list-check-linear', title: t('diff_4_title'), desc: t('diff_4_desc'), highlight: false },
  ]

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden antialiased" style={{ fontFamily: FONT_SANS, backgroundColor: BG, color: 'rgba(255,255,255,0.7)' }}>
      <style>{`
        ::selection { background: #3b82f64d; color: #3b82f6; }
        @keyframes sw-reveal { from { opacity: 0; transform: translateY(20px); filter: blur(8px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes sw-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .reveal-on-scroll { animation: sw-reveal 0.8s cubic-bezier(0.2,0.8,0.2,1) both; animation-play-state: paused; }
        .reveal-on-scroll.is-visible { animation-play-state: running; }
        .sw-marquee-track { animation: sw-marquee 32s linear infinite; }
        .sw-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.025] sw-grain" />

      <Nav
        navGetStarted={t('nav_get_started')}
        navLogin={t('nav_login')}
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navDiff={t('nav_diff')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        navMenuOpen={t('nav_menu_open')}
        navMenuClose={t('nav_menu_close')}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'id' : 'en')}
        activeSection={activeSectionState}
        onNavClick={scrollToSection}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        onLogin={() => router.push('/login')}
        onGetStarted={() => router.push('/register')}
      />

      <main>
        <Hero
          heroTagline={t('hero_tagline')}
          navGetStarted={t('nav_get_started')}
          navHow={t('nav_how')}
          heroPromptPlaceholder={t('hero_prompt_placeholder')}
          heroSendLabel={t('hero_send_label')}
          prompt={prompt}
          setPrompt={setPrompt}
          pendingType={pendingType}
          setPendingType={setPendingType}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={() => void handleSubmit()}
          onKeyDown={handleKeyDown}
        />

        <FormatMarquee label={t('nav_pipeline')} />

        <Harnesses
          kicker={t('harnesses_kicker')}
          title={t('harnesses_title')}
          desc={t('harnesses_desc')}
          reveal={reveal}
          rightWriteSpec={t('right_write_spec')}
          rightStructureBrief={t('right_structure_brief')}
          rightQuotation={t('right_quotation')}
        />

        <Pipeline
          kicker={t('pipeline_kicker')}
          titleL1={t('pipeline_title_l1')}
          titleL2={t('pipeline_title_l2')}
          cta={t('pipeline_cta')}
          onCtaClick={() => router.push('/register')}
          reveal={reveal}
          steps={pipelineSteps}
        />

        <Ingredients
          kicker={t('stack_kicker')}
          title={t('stack_title')}
          desc={t('stack_desc')}
          reveal={reveal}
          items={ingredientItems}
        />

        <SampleOutputsBanner
          kicker={t('samples_kicker')}
          titleL1={t('samples_title_l1')}
          titleL2={t('samples_title_l2')}
          desc={t('samples_desc')}
          reveal={reveal}
        />

        <Differentiators
          kicker={t('diff_kicker')}
          title={t('diff_title')}
          reveal={reveal}
          items={differentiatorItems}
        />

        <Pricing
          kicker={t('pricing_kicker')}
          titleL1={t('pricing_title_l1')}
          titleL2={t('pricing_title_l2')}
          desc={t('pricing_desc')}
          bestValue={t('pricing_best_value')}
          reveal={reveal}
          plans={PLANS}
          onSelectPlan={(slug) => { trackPostHog('plan_selected', { plan_slug: slug }); router.push(`/register?plan=${slug}`) }}
        />

        <FinalCta
          title={t('nav_get_started')}
          desc={t('hero_tagline')}
          reveal={reveal}
          prompt={prompt}
          setPrompt={setPrompt}
          pendingType={pendingType}
          setPendingType={setPendingType}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={() => void handleSubmit()}
          onKeyDown={handleKeyDown}
          placeholder={t('hero_prompt_placeholder')}
          sendLabel={t('hero_send_label')}
        />

        <Faq
          kicker={t('faq_kicker')}
          title={t('faq_title')}
          cta={t('faq_cta')}
          onCtaClick={() => router.push('/register')}
          reveal={reveal}
          lang={lang}
          openFaq={openFaq}
          setOpenFaq={setOpenFaq}
        />
      </main>

      <Footer
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        footerDesc={t('footer_desc')}
        footerProduct={t('footer_product')}
        footerLegal={t('footer_legal')}
        footerPrivacy={t('footer_privacy')}
        footerTerms={t('footer_terms')}
        footerRefund={t('footer_refund')}
        footerContact={t('footer_contact')}
        footerProductBy={t('footer_product_by')}
        onNavClick={scrollToSection}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm --prefix apps/web run build`
Expected: succeeds with no TypeScript errors and no unused-import warnings across `LandingPage.tsx` and all `landing/*.tsx` files.

- [ ] **Step 3: Manual verification**

Run: `npm --prefix apps/web run dev`, open `http://localhost:3000` in a browser.

Check:
- Hero video background plays (or gradient fallback shows if the video 404s) behind the headline.
- Nav is a glass pill, links scroll to the right section, active link highlights in blue, mobile hamburger menu opens/closes at narrow widths.
- Language toggle switches all visible copy between EN/ID including FAQ.
- Submitting the hero prompt while logged out redirects to `/register` (check `localStorage.sandwich_draft` is set).
- Pricing cards show the real Starter/Pro data with correct prices, "Best value" badge on Pro, clicking a plan CTA navigates to `/register?plan=<slug>`.
- FAQ accordion opens/closes on click.
- Scrolling reveals each section with the fade/blur-in animation.
- No console errors, no broken image icons.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/LandingPage.tsx
git commit -m "feat(web): reassemble LandingPage from redesigned section components"
```

---

### Task 17: Remove dead code and confirm no regressions

**Files:**
- Modify: none expected (verification-only task) — if Task 16's build/lint surfaces unused exports or leftover `sw-dashed` class references anywhere outside the landing page, fix those files.

- [ ] **Step 1: Search for leftover references to the retired `sw-dashed` utility class and the old lime hex**

Run:
```bash
grep -rn "sw-dashed\|c6f91f" apps/web/src/components/LandingPage.tsx apps/web/src/components/landing/
```
Expected: no matches (the redesign replaced every `sw-dashed`/lime reference with the blue/solid-border equivalents in Tasks 4-16). If any match remains, replace it following the same pattern used in the surrounding code in that file (solid `border-white/10` instead of `sw-dashed`, `ACCENT`/`#3b82f6` instead of `#c6f91f`).

- [ ] **Step 2: Full project typecheck**

Run: `npm --prefix apps/web run build`
Expected: succeeds, zero errors.

- [ ] **Step 3: Confirm the old inline `DeliverableTypeSelect` import path and other consumers of `LandingPage.tsx` still work**

Run:
```bash
grep -rn "LandingPage" apps/web/src/app/page.tsx
```
Expected: `apps/web/src/app/page.tsx` still imports `LandingPage` as a default export and renders `<LandingPage />` with no prop changes needed (confirmed by Task 16's unchanged export signature).

- [ ] **Step 4: Commit (only if Step 1 required fixes)**

```bash
git add -A
git commit -m "chore(web): clean up leftover pre-redesign references"
```
