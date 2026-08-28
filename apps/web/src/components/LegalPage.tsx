'use client'

import Link from 'next/link'
import { useLanguage } from '../lib/i18n'
import { LandingNav } from './landing/LandingNav'

const interTight = "'Inter Tight', 'Inter', sans-serif"

export interface LegalSection {
  heading: { en: string; id: string }
  body: { en: string; id: string }[]
}

interface LegalPageProps {
  title: { en: string; id: string }
  updated: string
  sections: LegalSection[]
}

export default function LegalPage({ title, updated, sections }: LegalPageProps) {
  const { lang, t } = useLanguage()

  return (
    <div className="min-h-screen antialiased" style={{ fontFamily: interTight, backgroundColor: '#ffffff' }}>
      <LandingNav />
      <div className="max-w-2xl mx-auto px-6 pt-24 pb-12 md:pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-8 hover:opacity-70 transition-opacity"
          style={{ color: '#0a0a0a' }}
        >
          <iconify-icon icon="solar:arrow-left-linear" width="14" />
          {t('legal_back')}
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: interTight, color: '#111827' }}>
          {title[lang]}
        </h1>
        <p className="text-xs text-zinc-500 mb-10">
          {lang === 'id' ? `Terakhir diperbarui: ${updated}` : `Last updated: ${updated}`}
        </p>

        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.heading.en}>
              <h2 className="text-base font-bold tracking-tight mb-2" style={{ color: '#111827' }}>
                {section.heading[lang]}
              </h2>
              <div className="flex flex-col gap-3">
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm text-zinc-600 leading-relaxed">
                    {p[lang]}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
