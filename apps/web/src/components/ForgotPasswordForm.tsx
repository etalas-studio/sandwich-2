'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { postForgotPassword } from '../api/auth'

const interTight = "'Inter Tight', 'Inter', sans-serif"

export default function ForgotPasswordForm({ onBack, modal }: { onBack?: () => void; modal?: boolean }) {
  const { t: tr } = useLanguage()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (!email.trim()) return
    setPending(true)
    setError(null)
    try {
      await postForgotPassword(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setPending(false)
    }
  }

  const handleBack = () => {
    if (onBack) onBack()
    else router.push('/')
  }

  const inputBg = modal ? 'rgba(255,255,255,0.12)' : '#F4EBE1'
  const inputIconColor = modal ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'
  const inputClass = modal
    ? 'flex-1 bg-transparent text-base placeholder:text-white/40 outline-none'
    : 'flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 outline-none'

  const cardStyle = modal
    ? { backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.15)' }
    : { backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }

  const titleColor = modal ? '#ffffff' : '#111827'
  const subtitleColor = modal ? 'rgba(255,255,255,0.5)' : undefined
  const btnPrimaryStyle = modal
    ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#ffffff' }
    : { backgroundColor: '#0a0a0a', color: '#ffffff' }
  const btnSecondaryStyle = modal
    ? { border: '1.5px solid rgba(255,255,255,0.2)', color: '#ffffff', backgroundColor: 'transparent' }
    : { border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }

  return (
    <div
      className={modal ? 'w-full max-w-sm' : 'min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10'}
      style={modal ? { fontFamily: interTight } : { fontFamily: interTight, backgroundColor: '#F4EBE1' }}
    >
      <div className="w-full max-w-sm rounded-3xl p-8" style={cardStyle}>
        <h1 className="text-2xl text-center tracking-tight mb-1.5 font-semibold" style={{ color: titleColor }}>{tr('forgot_title')}</h1>
        <p className="text-sm text-center mb-7" style={{ color: subtitleColor ?? 'rgba(0,0,0,0.45)' }}>{tr('forgot_subtitle')}</p>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('forgot_success')}</p>
            <button onClick={handleBack} className="w-full py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90" style={btnPrimaryStyle}>{tr('auth_back')}</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: inputBg }}>
              <iconify-icon icon="solar:letter-linear" width="18" style={{ color: inputIconColor, display: 'block' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                aria-label="Email"
                placeholder={tr('forgot_email_placeholder')}
                className={inputClass}
                style={modal ? { color: '#ffffff' } : { color: '#111827' }}
              />
            </div>
            {error && <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{error}</p>}
            <button type="submit" disabled={pending} className="w-full py-3.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2" style={btnPrimaryStyle}>{tr('forgot_submit')}</button>
            <button type="button" onClick={handleBack} className="w-full py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-80" style={btnSecondaryStyle}>{tr('auth_back')}</button>
          </form>
        )}
      </div>
    </div>
  )
}
