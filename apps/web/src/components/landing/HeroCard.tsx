'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

export interface HeroCardProps {
  heroTagline: string
  navPipeline: string
  navHow: string
  navDiff: string
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
  onScrollDownClick: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
}

const LINKS = (p: HeroCardProps) => [
  { id: 'harnesses', label: p.navPipeline },
  { id: 'experiences', label: p.navHow },
  { id: 'differentiators', label: p.navDiff },
  { id: 'pricing', label: p.navPricing },
  { id: 'faq', label: p.navFaq },
]

export function HeroCard(props: HeroCardProps) {
  const links = LINKS(props)

  return (
    <section id="hero" className="relative max-w-[96rem] mx-auto p-2 md:p-6 min-h-screen flex flex-col">
      <div
        className="relative flex-1 rounded-3xl overflow-hidden border flex flex-col justify-center"
        style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: PANEL_2 }}
      >
        {/* Background: CSS mesh gradient + grid, standing in for a photo */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 50% at 75% 15%, ${ACCENT}26, transparent 60%), radial-gradient(45% 40% at 15% 85%, ${ACCENT}14, transparent 65%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundSize: '40px 40px',
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #050505 0%, rgba(5,5,5,0.6) 60%, transparent 100%)' }} />
        </div>

        {/* Navigation — scrolls away with the hero, matching the reference */}
        <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl z-50">
          <div
            className="flex items-center justify-between px-4 py-3 rounded-full border backdrop-blur-xl"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full border text-xs tracking-widest uppercase"
                style={{ borderColor: 'rgba(255,255,255,0.2)', backgroundColor: ACCENT, color: '#ffffff' }}
              >
                S
              </span>
              <div className="hidden sm:block text-xs uppercase tracking-widest" style={{ color: TEXT_SECONDARY }}>SANDWICH</div>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: TEXT_MUTED }}>
              {links.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => { e.preventDefault(); props.onNavClick(id) }}
                  className="hover:opacity-100 transition-opacity"
                  style={{ opacity: 0.85 }}
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={props.onToggleLang}
                className="px-3 py-2 rounded-full text-xs font-semibold border"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: TEXT_PRIMARY }}
                title="Switch language"
              >
                {props.lang === 'en' ? 'EN' : 'ID'}
              </button>
              <button
                onClick={props.onLoginClick}
                className="px-4 py-2 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: TEXT_SECONDARY }}
              >
                {props.navLogin}
              </button>
              <button
                onClick={props.onGetStartedClick}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform"
                style={{ backgroundColor: '#ffffff', color: '#000000' }}
              >
                {props.navGetStarted}
              </button>
            </div>

            <button
              onClick={() => props.setMobileNavOpen(!props.mobileNavOpen)}
              aria-label={props.mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: TEXT_PRIMARY }}
            >
              <iconify-icon icon={props.mobileNavOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="20" />
            </button>
          </div>

          {props.mobileNavOpen && (
            <div
              className="md:hidden mt-2 rounded-2xl border backdrop-blur-xl flex flex-col overflow-hidden"
              style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.9)' }}
            >
              {links.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => { e.preventDefault(); props.onNavClick(id); props.setMobileNavOpen(false) }}
                  className="px-5 py-3.5 text-sm font-medium text-left border-b last:border-b-0"
                  style={{ color: TEXT_PRIMARY, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {label}
                </a>
              ))}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); props.onLoginClick(); props.setMobileNavOpen(false) }}
                className="px-5 py-3.5 text-sm font-medium text-left border-b last:border-b-0"
                style={{ color: TEXT_PRIMARY, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                {props.navLogin}
              </a>
              <div className="px-5 py-3.5 flex items-center gap-2">
                <button
                  onClick={props.onToggleLang}
                  className="px-3 py-2.5 rounded-full text-xs font-semibold border shrink-0"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: TEXT_PRIMARY }}
                >
                  {props.lang === 'en' ? 'EN' : 'ID'}
                </button>
                <button
                  onClick={props.onGetStartedClick}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                >
                  {props.navGetStarted}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 mt-20">
          <div
            id="hero-badge"
            className="reveal-on-scroll is-visible inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs uppercase tracking-widest mb-8 backdrop-blur-sm"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: TEXT_SECONDARY }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
            SANDWICH
          </div>

          <h1
            className="text-5xl md:text-7xl lg:text-8xl tracking-tighter font-medium leading-[0.95] max-w-5xl"
            style={{ color: TEXT_PRIMARY }}
          >
            SANDWICH
          </h1>

          <p className="mt-8 text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: TEXT_MUTED }}>
            {props.heroTagline}
          </p>

          <div className="mt-12 flex items-center gap-4">
            <button
              onClick={props.onScrollDownClick}
              className="inline-flex items-center justify-center w-12 h-12 rounded-full border transition-all hover:bg-white hover:text-black"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: TEXT_PRIMARY }}
            >
              <iconify-icon icon="solar:arrow-down-linear" width="20" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
