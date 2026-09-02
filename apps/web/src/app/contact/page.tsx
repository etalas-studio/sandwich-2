'use client'

import Link from 'next/link'
import { useLanguage } from '../../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

export default function Page() {
  const { t, lang } = useLanguage()

  return (
    <div className="min-h-screen antialiased" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-8 hover:opacity-70 transition-opacity"
          style={{ color: '#0a0a0a' }}
        >
          <iconify-icon icon="solar:arrow-left-linear" width="14" />
          {t('legal_back')}
        </Link>

        <h1 className="text-3xl md:text-4xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>
          {lang === 'id' ? 'Kontak' : 'Contact'}
        </h1>
        <p className="text-sm text-zinc-600 leading-relaxed mb-8 max-w-md">
          {lang === 'id'
            ? 'Ada pertanyaan soal Spectr, billing, atau data kamu? Kirim email ke kami, biasanya kami balas dalam 1-2 hari kerja.'
            : "Questions about Spectr, billing, or your data? Email us, we usually reply within 1-2 business days."}
        </p>

        <a
          href="mailto:support@spectr.id"
          className="inline-flex items-center gap-2.5 rounded-2xl px-5 py-4 bg-white"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <iconify-icon icon="solar:letter-linear" width="18" style={{ color: '#f91814' }} />
          <span className="text-sm font-semibold" style={{ color: '#111827' }}>support@spectr.id</span>
        </a>

        <p className="text-xs text-zinc-500 mt-8">
          {lang === 'id' ? 'Perusahaan: Etalas, ' : 'Company: Etalas, '}
          <a href="https://etalas.com" target="_blank" rel="noreferrer" className="underline hover:opacity-70">
            etalas.com
          </a>
        </p>
      </div>
    </div>
  )
}
