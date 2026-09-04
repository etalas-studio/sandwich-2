'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'

const LandingPage = dynamic(() => import('../components/LandingPage'), { ssr: false })

function NotFoundOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {/* Illustration */}
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
          <ellipse cx="60" cy="90" rx="44" ry="6" fill="rgba(255,255,255,0.06)" />
          <rect x="34" y="20" width="52" height="64" rx="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <path d="M74 20 L86 32 L74 32 Z" fill="rgba(255,255,255,0.15)" />
          <path d="M74 20 L86 32" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <rect x="42" y="40" width="28" height="2.5" rx="1.25" fill="rgba(255,255,255,0.25)" />
          <rect x="42" y="48" width="20" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)" />
          <rect x="42" y="56" width="24" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)" />
          <line x1="44" y1="66" x2="56" y2="78" stroke="rgba(99,102,241,0.9)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="56" y1="66" x2="44" y2="78" stroke="rgba(99,102,241,0.9)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="88" cy="38" r="10" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="rgba(255,255,255,0.05)" />
          <line x1="95" y1="45" x2="103" y2="53" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
          <text x="84" y="43" fontSize="10" fill="rgba(255,255,255,0.6)" fontWeight="700" fontFamily="sans-serif">?</text>
        </svg>

        <p
          className="text-7xl font-bold tracking-tight mb-2"
          style={{ color: 'rgba(99,102,241,0.95)', fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.04em' }}
        >
          404
        </p>

        <h1 className="text-lg font-semibold mb-2" style={{ color: '#ffffff', fontFamily: "'Instrument Serif', serif" }}>
          Page not found
        </h1>

        <p className="text-sm mb-7" style={{ color: 'rgba(255,255,255,0.5)' }}>
          This page doesn&apos;t exist or was moved.
        </p>

        <Link
          href="/"
          className="w-full py-3.5 rounded-full text-sm font-semibold text-center transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(99,102,241,0.9))', color: '#ffffff', textDecoration: 'none', display: 'block' }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default function NotFound() {
  return (
    <>
      <LandingPage />
      <NotFoundOverlay />
    </>
  )
}
