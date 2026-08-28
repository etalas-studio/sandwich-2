'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../lib/i18n'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './landing/tokens'

export default function Header() {
  const { lang, setLang, t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const anchorLinks = [
    { id: 'ingredients', label: t('stack_kicker') },
    { id: 'harnesses', label: t('harnesses_kicker') },
    { id: 'pipeline', label: t('nav_diff') },
    { id: 'pricing', label: t('nav_pricing') },
    { id: 'faq', label: t('nav_faq') },
  ]

  return (
    <div className="relative flex justify-center w-full">
      <nav className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-full ring-1 ring-black/10 bg-white/80 backdrop-blur-sm max-w-full">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pl-1 pr-2 shrink-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
        </Link>

        {/* Desktop anchor links */}
        <div className="hidden md:flex items-center gap-1">
          {anchorLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors hover:text-neutral-900"
              style={{ color: LIGHT_TEXT_MUTED }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/blog"
            className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{ color: pathname?.startsWith('/blog') ? ACCENT : LIGHT_TEXT_MUTED }}
          >
            Blog
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label={mobileNavOpen ? t('nav_menu_close') : t('nav_menu_open')}
          aria-expanded={mobileNavOpen}
          className="md:hidden shrink-0 w-11 h-11 flex items-center justify-center rounded-full"
          style={{ color: LIGHT_TEXT_PRIMARY }}
        >
          <iconify-icon icon={mobileNavOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'} width="18" />
        </button>

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
          className="shrink-0 px-4 min-w-[52px] min-h-11 flex items-center justify-center rounded-full text-xs font-semibold transition-colors bg-black/5 hover:bg-black/10"
          style={{ color: LIGHT_TEXT_PRIMARY }}
          title="Switch language"
        >
          {lang === 'en' ? 'EN' : 'ID'}
        </button>

        {/* Login */}
        <button
          onClick={() => router.push('/login')}
          className="hidden sm:flex shrink-0 px-3 sm:px-4 min-h-11 items-center rounded-full text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ring-1 ring-black/10 hover:bg-black/5"
          style={{ color: LIGHT_TEXT_MUTED }}
        >
          {t('nav_login')}
        </button>

        {/* Get Started */}
        <button
          onClick={() => router.push('/register')}
          className="shrink-0 px-3 sm:px-4 min-h-11 flex items-center rounded-full text-xs sm:text-sm font-medium ring-1 ring-black/10 bg-black/5 hover:bg-black/10 backdrop-blur-sm transition-all active:scale-95 whitespace-nowrap"
          style={{ color: LIGHT_TEXT_PRIMARY }}
        >
          {t('nav_get_started')}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100%-2rem)] max-w-sm rounded-2xl ring-1 ring-black/10 bg-white flex flex-col overflow-hidden shadow-lg">
          {anchorLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              className="px-5 py-3.5 text-sm font-medium text-left border-b border-black/5 last:border-b-0"
              style={{ color: LIGHT_TEXT_PRIMARY }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/blog"
            onClick={() => setMobileNavOpen(false)}
            className="px-5 py-3.5 text-sm font-medium text-left border-b border-black/5 last:border-b-0"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            Blog
          </Link>
          <button
            onClick={() => router.push('/login')}
            className="px-5 py-3.5 text-sm font-medium text-left"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            {t('nav_login')}
          </button>
        </div>
      )}
    </div>
  )
}
