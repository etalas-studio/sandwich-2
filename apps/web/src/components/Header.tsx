'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

export default function Header() {
  const { lang, setLang, t } = useLanguage()
  const router = useRouter()
  const activeSectionRef = useRef<string>('')
  const [activeSectionState, setActiveSectionState] = useState<string>('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const anchorLinks = [
    { id: 'harnesses', label: t('nav_pipeline') },
    { id: 'pipeline', label: t('nav_how') },
    { id: 'differentiators', label: t('nav_diff') },
    { id: 'pricing', label: t('nav_pricing') },
    { id: 'faq', label: t('nav_faq') },
  ]

  return (
    <div className="relative flex justify-center w-full">
      <nav
        className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-full border max-w-full"
        style={{
          backgroundColor: '#F4EBE1',
          borderColor: 'rgba(0,0,0,0.1)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <Link href="/">
          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-1" style={{ backgroundColor: '#f91814' }}>
            <span className="text-white font-black text-[10px]" style={{ fontFamily: bowlby }}>S</span>
          </div>
        </Link>

        {/* Desktop anchor links */}
        <div className="hidden md:flex items-center gap-1">
          {anchorLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={(e) => {
                const el = document.getElementById(id)
                if (el) {
                  e.preventDefault()
                  activeSectionRef.current = id
                  setActiveSectionState(id)
                  el.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors"
              style={{ color: activeSectionState === id ? '#0a0a0a' : '#6b7280', fontWeight: activeSectionState === id ? 600 : 500 }}
            >
              {label}
            </a>
          ))}
          {/* Blog route link */}
          <Link
            href="/blog"
            className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{ color: '#6b7280' }}
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
          style={{ color: '#0a0a0a' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {mobileNavOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
          className="shrink-0 px-4 min-w-[52px] min-h-11 flex items-center justify-center rounded-full text-xs font-semibold transition-colors"
          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: '#0a0a0a' }}
          title="Switch language"
        >
          {lang === 'en' ? 'EN' : 'ID'}
        </button>

        {/* Login */}
        <button
          onClick={() => router.push('/login')}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f91814'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#f91814' }}
          className="shrink-0 px-3 sm:px-4 min-h-11 flex items-center rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
          style={{ backgroundColor: 'transparent', color: '#f91814', outline: '1.5px solid #f91814', outlineOffset: '-1.5px' }}
        >
          {t('nav_login')}
        </button>

        {/* Get Started */}
        <button
          onClick={() => router.push('/register')}
          className="shrink-0 px-3 sm:px-4 min-h-11 flex items-center rounded-full text-xs sm:text-sm font-semibold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
          style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
        >
          {t('nav_get_started')}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {mobileNavOpen && (
        <div
          className="md:hidden absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100%-2rem)] max-w-sm rounded-2xl border flex flex-col overflow-hidden"
          style={{ backgroundColor: '#F4EBE1', borderColor: 'rgba(0,0,0,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {anchorLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={(e) => {
                const el = document.getElementById(id)
                if (el) {
                  e.preventDefault()
                  activeSectionRef.current = id
                  setActiveSectionState(id)
                  setMobileNavOpen(false)
                  el.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="px-5 py-3.5 text-sm font-medium text-left border-b last:border-b-0"
              style={{ color: '#0a0a0a', borderColor: 'rgba(0,0,0,0.06)' }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/blog"
            onClick={() => setMobileNavOpen(false)}
            className="px-5 py-3.5 text-sm font-medium text-left border-b last:border-b-0"
            style={{ color: '#0a0a0a', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            Blog
          </Link>
        </div>
      )}
    </div>
  )
}
