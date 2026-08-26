'use client'

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
    <div className="fixed top-0 left-0 right-0 z-50 pt-6 px-4 sm:px-6 lg:px-8">
      <nav className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="flex items-center gap-2 shrink-0"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight uppercase" style={{ color: TEXT_PRIMARY }}>SANDWICH</span>
        </a>

        <div className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 backdrop-blur-lg">
          {links.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => { e.preventDefault(); onNavClick(id) }}
              className="shrink-0 px-3.5 py-2 text-sm font-medium rounded-full transition-colors"
              style={{ color: activeSection === id ? TEXT_PRIMARY : 'rgba(255,255,255,0.6)', backgroundColor: activeSection === id ? 'rgba(255,255,255,0.08)' : 'transparent' }}
            >
              {label}
            </a>
          ))}
          <button
            onClick={props.onToggleLang}
            className="shrink-0 ml-1 px-3.5 py-2 min-w-[44px] flex items-center justify-center rounded-full text-xs font-semibold transition-colors bg-white/10"
            style={{ color: TEXT_PRIMARY }}
            title="Switch language"
          >
            {props.lang === 'en' ? 'EN' : 'ID'}
          </button>
          <button
            onClick={onLogin}
            className="shrink-0 px-3.5 py-2 text-sm font-medium rounded-full transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {props.navLogin}
          </button>
          <button
            onClick={onGetStarted}
            className="group relative shrink-0 overflow-hidden rounded-full px-5 py-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: ACCENT, color: '#ffffff' }}
          >
            <span className="relative z-10">{props.navGetStarted}</span>
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 right-1/2 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 transition-[left,right] duration-500 ease-out group-hover:left-0 group-hover:right-0" />
          </button>
        </div>

        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label={mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
          aria-expanded={mobileNavOpen}
          className="md:hidden inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-medium backdrop-blur"
          style={{ color: TEXT_PRIMARY }}
        >
          <iconify-icon icon={mobileNavOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="20" />
          {mobileNavOpen ? props.navMenuClose : props.navMenuOpen}
        </button>
      </nav>

      {mobileNavOpen && (
        <div
          className="md:hidden max-w-7xl mx-auto mt-2 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-lg flex flex-col overflow-hidden"
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
          <div className="flex items-center gap-2 px-5 py-3.5">
            <button
              onClick={props.onToggleLang}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white/10"
              style={{ color: TEXT_PRIMARY }}
            >
              {props.lang === 'en' ? 'EN' : 'ID'}
            </button>
            <button onClick={onLogin} className="px-4 py-2 rounded-full text-xs font-medium border border-white/10" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {props.navLogin}
            </button>
            <button onClick={onGetStarted} className="px-4 py-2 rounded-full text-xs font-semibold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>
              {props.navGetStarted}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
