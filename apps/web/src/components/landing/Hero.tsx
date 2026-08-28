'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { GridLines } from './GridLines'
import { ACCENT, TEXT_PRIMARY, LIGHT_TEXT_PRIMARY, FONT_SANS } from './tokens'

export interface HeroSuggestion {
  label: string
  prompt: string
}

export interface HeroAttachment {
  name: string
  type: string
  dataUrl: string
}

export interface HeroProps {
  heroTagline: string
  heroTaglineSans: string
  heroBenefit: string
  navHow: string
  navDiff: string
  navDeliverables: string
  navComparison: string
  navPricing: string
  navFaq: string
  navGetStarted: string
  navLogin: string
  navMenuOpen: string
  navMenuClose: string
  lang: 'en' | 'id'
  onToggleLang: () => void
  onNavClick: (id: string) => void
  onGetStartedClick: () => void
  onLoginClick: () => void
  onSecondaryClick: () => void
  onPromptSubmit: (prompt: string, attachments: HeroAttachment[]) => void
  heroPromptPlaceholder: string
  heroSendLabel: string
  suggestions: HeroSuggestion[]
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
}

const LINKS = (p: HeroProps) => [
  { id: 'why', label: p.navDiff },
  { id: 'pipeline', label: p.navHow },
  { id: 'deliverables', label: p.navDeliverables },
  { id: 'comparison', label: p.navComparison },
  { id: 'pricing', label: p.navPricing },
  { id: 'faq', label: p.navFaq },
]

export function Hero(props: HeroProps) {
  const links = LINKS(props)

  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<HeroAttachment[]>([])
  const [typed, setTyped] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submitPrompt = () => {
    const value = prompt.trim()
    if (!value && images.length === 0) return
    props.onPromptSubmit(value, images)
  }

  // Typing placeholder animation — types out the placeholder when the box is empty.
  useEffect(() => {
    if (prompt !== '') {
      setTyped('')
      return
    }
    const full = props.heroPromptPlaceholder
    let i = 0
    let deleting = false
    const interval = setInterval(() => {
      if (!deleting) {
        i += 1
        setTyped(full.slice(0, i))
        if (i >= full.length) deleting = true
      } else {
        i -= 1
        setTyped(full.slice(0, i))
        if (i <= 0) deleting = false
      }
    }, deleting ? 35 : 55)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, props.heroPromptPlaceholder])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [
          ...prev,
          { name: file.name, type: file.type, dataUrl: String(reader.result) },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight - 100
      // The ClosingCta card sits on a dark grass background — keep the navbar
      // in white/glass mode while it overlaps that dark card (not the section's
      // white padding above/below it).
      const darkCard = document.getElementById('start-card')
      const overDarkCard = darkCard
        ? darkCard.getBoundingClientRect().top <= 90 && darkCard.getBoundingClientRect().bottom >= 90
        : false
      setScrolled(pastHero && !overDarkCard)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navTextColor = scrolled ? LIGHT_TEXT_PRIMARY : TEXT_PRIMARY
  const pillClass = scrolled
    ? 'bg-black/5 ring-black/10 text-neutral-900/90 hover:bg-black/10 hover:ring-black/20'
    : 'bg-white/5 ring-white/10 text-white/90 hover:bg-white/10 hover:ring-white/20'
  const groupRingClass = scrolled ? 'ring-black/5' : 'ring-white/5'

  return (
    <div className="relative h-screen overflow-hidden" style={{ backgroundColor: '#020617' }}>
      {/* Video backdrop, shown at full strength - no added scrim. No negative z-index here - painted first in DOM order, header/main below carry explicit z-20 so they stack above naturally. */}
      <div className="absolute inset-0">
        <video
          src="/hero-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <GridLines dark />

      {/* Header / Nav - fixed so it stays in place while the rest of the page scrolls underneath. Colors invert once scrolled past the hero onto light sections. */}
      <header className={`fixed top-0 inset-x-0 z-30 border-b transition-colors duration-300 ${scrolled ? 'border-black/5' : 'border-white/5'}`}>
        <div className="flex md:px-8 max-w-7xl mr-auto ml-auto pt-5 pr-6 pb-5 pl-6 items-center justify-between">
          <div className={`flex md:gap-6 ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-4 gap-y-4 items-center transition-colors duration-300 ${groupRingClass}`}>
            <a href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`flex items-center gap-2 pl-2 pr-3 shrink-0 rounded-full ring-1 backdrop-blur-md transition-colors duration-300 ${scrolled ? 'bg-black/5 ring-black/10 hover:bg-black/10' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`} style={{ boxShadow: scrolled ? '0 1px 2px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.06)' }}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
              <span className="hidden sm:inline text-xs uppercase tracking-widest font-medium transition-colors duration-300" style={{ color: navTextColor }}>SANDWICH</span>
            </a>

            <nav className="hidden md:flex gap-2 gap-x-2 gap-y-2 items-center">
              {links.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => { e.preventDefault(); props.onNavClick(id) }}
                  className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
                >
                  {label}
                </a>
              ))}
              <Link
                href="/blog"
                className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
              >
                Blog
              </Link>
            </nav>
          </div>

          <div className={`hidden md:flex ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-2 gap-y-2 items-center transition-colors duration-300 ${groupRingClass}`}>
            <button
              onClick={props.onToggleLang}
              className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
              title="Switch language"
            >
              <span className="uppercase tracking-wide text-xs font-bold transition-colors duration-300" style={{ color: navTextColor }}>{props.lang === 'en' ? 'EN' : 'ID'}</span>
            </button>
            <button
              onClick={props.onLoginClick}
              className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
            >
              {props.navLogin}
            </button>
            <button
              onClick={props.onGetStartedClick}
              className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
            >
              {props.navGetStarted}
            </button>
          </div>

          <button
            onClick={() => props.setMobileNavOpen(!props.mobileNavOpen)}
            aria-label={props.mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
            className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full ring-1 transition-colors duration-300 ${scrolled ? 'ring-black/10' : 'ring-white/10'}`}
            style={{ color: navTextColor }}
          >
            <iconify-icon icon={props.mobileNavOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="20" />
          </button>
        </div>

        {props.mobileNavOpen && (
          <div className={`md:hidden mx-6 mb-4 rounded-2xl ring-1 backdrop-blur-xl flex flex-col overflow-hidden ${scrolled ? 'ring-black/10 bg-white/95' : 'ring-white/10 bg-black/80'}`}>
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => { e.preventDefault(); props.onNavClick(id); props.setMobileNavOpen(false) }}
                className={`px-5 py-3.5 text-sm font-medium text-left border-b last:border-b-0 ${scrolled ? 'border-black/10' : 'border-white/10'}`}
                style={{ color: navTextColor }}
              >
                {label}
              </a>
            ))}
            <Link
              href="/blog"
              onClick={() => props.setMobileNavOpen(false)}
              className={`px-5 py-3.5 text-sm font-medium text-left border-b ${scrolled ? 'border-black/10' : 'border-white/10'}`}
              style={{ color: navTextColor }}
            >
              Blog
            </Link>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); props.onLoginClick(); props.setMobileNavOpen(false) }}
              className={`px-5 py-3.5 text-sm font-medium text-left border-b ${scrolled ? 'border-black/10' : 'border-white/10'}`}
              style={{ color: navTextColor }}
            >
              {props.navLogin}
            </a>
            <div className="px-5 py-3.5 flex items-center gap-2">
              <button onClick={props.onToggleLang} className={`px-3 py-2.5 rounded-full text-xs font-semibold ring-1 shrink-0 ${scrolled ? 'ring-black/15' : 'ring-white/15'}`} style={{ color: navTextColor }}>
                {props.lang === 'en' ? 'EN' : 'ID'}
              </button>
              <button onClick={props.onGetStartedClick} className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                {props.navGetStarted}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero content */}
      <main className="z-20 flex h-[calc(100vh-80px)] relative items-center">
        <section className="md:px-8 w-full max-w-6xl mr-auto ml-auto pr-6 pl-6 text-center">
          <h1 className="leading-tight tracking-tight" style={{ fontSize: 'clamp(1.5rem, 5vw, 4rem)' }}>
            <span
              className="block"
              style={{ color: TEXT_PRIMARY, fontFamily: FONT_SANS, fontStyle: 'normal', letterSpacing: '-0.02em' }}
            >
              {props.heroTaglineSans}
            </span>
            <span
              className="block tracking-tight"
              style={{ color: TEXT_PRIMARY, fontStyle: 'italic' }}
            >
              {props.heroTagline}
            </span>
          </h1>

          {/* Prompt box — transparent/glass, taller, with image attach, suggestions & typing placeholder */}
          <form
            onSubmit={(e) => { e.preventDefault(); submitPrompt() }}
            className="mx-auto mt-10 w-full max-w-2xl rounded-3xl bg-slate-400/15 ring-1 ring-white/15 backdrop-blur-xl transition hover:ring-white/25 focus-within:ring-white/30 p-4 md:p-5"
          >
            {/* Textarea with typing placeholder overlay */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                aria-label={props.heroPromptPlaceholder}
                className="w-full resize-none bg-transparent px-3 py-2 text-base md:text-lg text-white/90 outline-none placeholder:text-transparent leading-relaxed"
              />
              {prompt === '' && (
                <div className="pointer-events-none absolute inset-0 px-3 py-2 text-base md:text-lg text-white/40 leading-relaxed">
                  {typed}
                  <span className="inline-block w-0.5 h-5 bg-white/60 align-text-bottom ml-0.5 animate-pulse" />
                </div>
              )}
            </div>

            {/* Attached images preview */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1 pb-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden ring-1 ring-white/20">
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    >
                      <iconify-icon icon="solar:close-linear" width="12" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom row: attach + suggestions + send */}
            <div className="flex items-center gap-2 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white/90 transition"
              >
                <iconify-icon icon="solar:gallery-add-linear" width="18" />
              </button>

              <button
                type="submit"
                disabled={!prompt.trim() && images.length === 0}
                aria-label={props.heroSendLabel}
                title={props.heroSendLabel}
                className="ml-auto shrink-0 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                <iconify-icon icon="solar:arrow-up-linear" width="16" style={{ color: '#ffffff' }} />
              </button>
            </div>
          </form>

          {/* Suggestion badges — click to fill the prompt */}
          {props.suggestions.length > 0 && (
            <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
              {props.suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setPrompt(s.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm hover:bg-white/10 hover:text-white/90 hover:ring-white/25 transition"
                >
                  <iconify-icon icon="solar:sparkles-linear" width="13" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
