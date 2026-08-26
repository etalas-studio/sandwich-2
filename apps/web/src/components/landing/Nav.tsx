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
