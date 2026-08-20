'use client'

import Link from 'next/link'
import { useLanguage } from '../lib/i18n'

export default function NotFound() {
  const { t } = useLanguage()

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '24px', textAlign: 'center', backgroundColor: '#f4ebe1',
      }}
    >
      <p style={{ fontFamily: "'Bowlby One', system-ui", fontSize: '64px', color: '#f91814', margin: 0, letterSpacing: '-0.03em' }}>
        404
      </p>
      <h1 style={{ fontFamily: "'Bowlby One', system-ui", fontSize: '22px', color: '#1a1a1a', marginTop: '12px', letterSpacing: '-0.03em' }}>
        {t('notfound_title')}
      </h1>
      <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginTop: '8px', maxWidth: '360px' }}>
        {t('notfound_desc')}
      </p>
      <Link
        href="/"
        style={{
          marginTop: '24px', padding: '10px 24px', borderRadius: '999px',
          backgroundColor: '#0a0a0a', color: '#fff', fontSize: '14px', fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        {t('notfound_home')}
      </Link>
    </div>
  )
}
