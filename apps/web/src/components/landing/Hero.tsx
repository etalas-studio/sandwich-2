'use client'

import { GridLines } from './GridLines'
import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface HeroProps {
  heroTagline: string
  heroBenefit: string
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
  onSecondaryClick: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
}

const LINKS = (p: HeroProps) => [
  { id: 'ingredients', label: p.navPipeline },
  { id: 'harnesses', label: p.navHow },
  { id: 'pipeline', label: p.navDiff },
  { id: 'pricing', label: p.navPricing },
  { id: 'faq', label: p.navFaq },
]

export function Hero(props: HeroProps) {
  const links = LINKS(props)

  return (
    <div className="relative h-screen overflow-hidden" style={{ backgroundColor: '#020617' }}>
      {/* Video backdrop, shown at full strength - no added scrim. No negative z-index here - painted first in DOM order, header/main below carry explicit z-20 so they stack above naturally. */}
      <div className="absolute inset-0">
        <video
          src="/hero-bg.webm"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <GridLines />

      {/* Header / Nav - fixed so it stays in place while the rest of the page scrolls underneath */}
      <header className="fixed top-0 inset-x-0 z-30 border-white/5 border-b">
        <div className="flex md:px-8 max-w-7xl mr-auto ml-auto pt-5 pr-6 pb-5 pl-6 items-center justify-between">
          <div className="flex md:gap-6 ring-white/5 ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-4 gap-y-4 items-center">
            <a href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex items-center gap-2 pl-2 pr-3 shrink-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
              <span className="hidden sm:inline text-xs uppercase tracking-widest font-medium" style={{ color: TEXT_PRIMARY }}>SANDWICH</span>
            </a>

            <nav className="hidden md:flex gap-2 gap-x-2 gap-y-2 items-center">
              {links.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => { e.preventDefault(); props.onNavClick(id) }}
                  className="inline-flex items-center gap-2 transition hover:bg-white/10 hover:ring-white/20 text-sm font-medium text-white/90 bg-white/5 ring-white/10 ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex ring-white/5 ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-2 gap-y-2 items-center">
            <button
              onClick={props.onToggleLang}
              className="inline-flex items-center gap-2 transition hover:bg-white/10 hover:ring-white/20 text-sm font-medium text-white/90 bg-white/5 ring-white/10 ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm"
              title="Switch language"
            >
              <span className="uppercase tracking-wide text-xs font-bold text-white">{props.lang === 'en' ? 'EN' : 'ID'}</span>
            </button>
            <button
              onClick={props.onLoginClick}
              className="inline-flex items-center gap-2 transition hover:bg-white/10 hover:ring-white/20 text-sm font-medium text-white/90 bg-white/5 ring-white/10 ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm"
            >
              {props.navLogin}
            </button>
            <button
              onClick={props.onGetStartedClick}
              className="inline-flex items-center gap-2 transition hover:bg-white/15 hover:ring-white/25 ring-white/15 ring-1 text-sm font-medium text-white/90 bg-white/10 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm"
            >
              {props.navGetStarted}
            </button>
          </div>

          <button
            onClick={() => props.setMobileNavOpen(!props.mobileNavOpen)}
            aria-label={props.mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full ring-1 ring-white/10"
            style={{ color: TEXT_PRIMARY }}
          >
            <iconify-icon icon={props.mobileNavOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="20" />
          </button>
        </div>

        {props.mobileNavOpen && (
          <div className="md:hidden mx-6 mb-4 rounded-2xl ring-1 ring-white/10 bg-black/80 backdrop-blur-xl flex flex-col overflow-hidden">
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => { e.preventDefault(); props.onNavClick(id); props.setMobileNavOpen(false) }}
                className="px-5 py-3.5 text-sm font-medium text-left border-b border-white/10 last:border-b-0"
                style={{ color: TEXT_PRIMARY }}
              >
                {label}
              </a>
            ))}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); props.onLoginClick(); props.setMobileNavOpen(false) }}
              className="px-5 py-3.5 text-sm font-medium text-left border-b border-white/10"
              style={{ color: TEXT_PRIMARY }}
            >
              {props.navLogin}
            </a>
            <div className="px-5 py-3.5 flex items-center gap-2">
              <button onClick={props.onToggleLang} className="px-3 py-2.5 rounded-full text-xs font-semibold ring-1 ring-white/15 shrink-0" style={{ color: TEXT_PRIMARY }}>
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
      <main className="z-20 flex h-[calc(100vh-80px)] relative items-end">
        <section className="md:px-8 md:pb-16 lg:pb-20 w-full max-w-7xl mr-auto ml-auto pr-6 pb-12 pl-6">
          <div className="mb-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-12 md:gap-6 lg:gap-10 gap-x-8 gap-y-8 items-center">
            <div className="md:col-span-7 lg:col-span-6 relative">
              <div className="inline-flex text-xs font-medium text-white/80 bg-white/5 ring-white/10 ring-1 rounded-full mb-5 pt-1.5 pr-3 pb-1.5 pl-3 backdrop-blur-sm gap-x-2 gap-y-2 items-center">
                <iconify-icon icon="solar:sparkles-linear" width="16" className="text-white/80" />
                <span>SANDWICH</span>
              </div>

              <h1 className="leading-tight sm:text-5xl md:text-5xl lg:text-6xl text-4xl tracking-tighter">
                <span style={{ color: TEXT_PRIMARY }}>SANDWICH</span>
                <span
                  className="block bg-clip-text text-transparent tracking-tighter"
                  style={{ backgroundImage: `linear-gradient(90deg, ${TEXT_PRIMARY}, ${TEXT_PRIMARY}, ${TEXT_MUTED})` }}
                >
                  {props.heroTagline}
                </span>
              </h1>
            </div>

            <div className="hidden md:block md:col-span-1 relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-white/5 -translate-x-1/2" />
            </div>

            <div className="md:col-span-12 lg:col-span-4 relative">
              <div className="border-white/10 border-t pt-6 md:border-t-0 md:pt-0">
                <div className="flex gap-4 text-sm text-white/50 gap-x-4 gap-y-4 items-center mb-6">
                  <div className="flex items-center gap-2">
                    <iconify-icon icon="solar:bolt-linear" width="16" className="opacity-50" />
                    <span>{props.heroBenefit}</span>
                  </div>
                </div>
                <div className="flex flex-row gap-x-3 gap-y-3">
                  <button
                    onClick={props.onGetStartedClick}
                    className="inline-flex items-center justify-center gap-2 transition hover:bg-white/15 hover:ring-white/25 whitespace-nowrap text-sm font-medium text-white/90 bg-white/10 ring-white/15 ring-1 rounded-full pt-2.5 pr-4 pb-2.5 pl-4 backdrop-blur-sm"
                  >
                    <span>{props.navGetStarted}</span>
                    <iconify-icon icon="solar:arrow-right-linear" width="16" />
                  </button>
                  <button
                    onClick={props.onSecondaryClick}
                    className="inline-flex items-center justify-center gap-2 ring-1 ring-white/20 transition hover:bg-neutral-100 whitespace-nowrap text-sm font-medium text-neutral-900 bg-white rounded-full pt-2.5 pr-4 pb-2.5 pl-4"
                  >
                    <span>{props.navDiff}</span>
                    <iconify-icon icon="solar:widget-2-linear" width="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
