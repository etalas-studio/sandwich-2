'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../lib/i18n'
import { ACCENT, LIGHT_TEXT_PRIMARY } from './tokens'

const pillClass = 'bg-black/5 ring-black/10 text-neutral-900/90 hover:bg-black/10 hover:ring-black/20'
const groupRingClass = 'ring-black/5'

const NAV_LINKS_EN = [
  { id: 'why', label: 'Why Spectr' },
  { id: 'pipeline', label: 'How It Works' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]
const NAV_LINKS_ID = [
  { id: 'why', label: 'Kenapa Spectr' },
  { id: 'pipeline', label: 'Cara Kerja' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'comparison', label: 'Perbandingan' },
  { id: 'pricing', label: 'Harga' },
  { id: 'faq', label: 'FAQ' },
]

interface LandingNavProps {
  onLoginClick?: () => void
}

export function LandingNav({ onLoginClick }: LandingNavProps = {}) {
  const { lang, setLang, t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = lang === 'id' ? NAV_LINKS_ID : NAV_LINKS_EN

  return (
    <header className="fixed top-0 inset-x-0 z-30 border-b border-black/5">
      <div className="flex md:px-8 max-w-7xl mr-auto ml-auto pt-5 pr-6 pb-5 pl-6 items-center justify-between">
        {/* Left: logo + nav links */}
        <div className={`flex md:gap-6 ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-4 gap-y-4 items-center transition-colors duration-300 ${groupRingClass}`}>
          <a
            href="/"
            className={`flex items-center gap-2 pl-2 pr-3 shrink-0 rounded-full ring-1 backdrop-blur-md transition-colors duration-300 bg-black/5 ring-black/10 hover:bg-black/10`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
            <span className="hidden sm:inline text-xs uppercase tracking-widest font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>Spectr</span>
          </a>

          <nav className="hidden md:flex gap-2 items-center">
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`/#${id}`}
                className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
              >
                {label}
              </a>
            ))}
            <Link
              href="/blog"
              className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
              style={{ color: pathname?.startsWith('/blog') ? ACCENT : undefined }}
            >
              Blog
            </Link>
          </nav>
        </div>

        {/* Right: lang + login + CTA */}
        <div className={`hidden md:flex ring-1 rounded-full pt-1 pr-1 pb-1 pl-1 gap-x-2 gap-y-2 items-center transition-colors duration-300 ${groupRingClass}`}>
          <button
            onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
            title="Switch language"
          >
            <span className="uppercase tracking-wide text-xs font-bold" style={{ color: LIGHT_TEXT_PRIMARY }}>{lang === 'en' ? 'EN' : 'ID'}</span>
          </button>
          <button
            onClick={() => onLoginClick ? onLoginClick() : router.push('/login')}
            className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
          >
            {t('nav_login')}
          </button>
          <button
            onClick={() => router.push('/register')}
            className={`inline-flex items-center gap-2 transition-colors duration-300 text-sm font-medium ring-1 rounded-full pt-2 pr-3.5 pb-2 pl-3.5 backdrop-blur-sm ${pillClass}`}
          >
            {t('nav_get_started')}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? t('nav_menu_close') : t('nav_menu_open')}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full ring-1 ring-black/10 transition-colors duration-300"
          style={{ color: LIGHT_TEXT_PRIMARY }}
        >
          <iconify-icon icon={mobileOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="20" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden mx-6 mb-4 rounded-2xl ring-1 ring-black/10 bg-white/95 backdrop-blur-xl flex flex-col overflow-hidden">
          {links.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={() => setMobileOpen(false)}
              className="px-5 py-3.5 text-sm font-medium text-left border-b border-black/10 last:border-b-0"
              style={{ color: LIGHT_TEXT_PRIMARY }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/blog"
            onClick={() => setMobileOpen(false)}
            className="px-5 py-3.5 text-sm font-medium text-left border-b border-black/10"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            Blog
          </Link>
          <button
            onClick={() => router.push('/login')}
            className="px-5 py-3.5 text-sm font-medium text-left border-b border-black/10"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            {t('nav_login')}
          </button>
          <button
            onClick={() => router.push('/register')}
            className="px-5 py-3.5 text-sm font-medium text-left"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            {t('nav_get_started')}
          </button>
        </div>
      )}
    </header>
  )
}
