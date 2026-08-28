import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLanguage } from '../lib/i18n'
import { postResendVerification } from '../api/auth'

const interTight = "'Inter Tight', 'Inter', sans-serif"

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>
  error: string | null
  isPending: boolean
  onBack: () => void
  onSwitchToRegister?: () => void
  onForgotPassword?: () => void
  modal?: boolean
}

export default function LoginForm({ onSubmit, error, isPending, onBack, onSwitchToRegister, onForgotPassword, modal }: LoginFormProps) {
  const { t: tr } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendSent, setResendSent] = useState(false)
  const [resending, setResending] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit(username, password)
  }

  const handleResend = async () => {
    if (!resendEmail.trim() || resending) return
    setResending(true)
    try {
      await postResendVerification(resendEmail.trim())
      setResendSent(true)
    } catch {
      /* ignore */
    } finally {
      setResending(false)
    }
  }

  const inputBg = modal ? 'rgba(255,255,255,0.12)' : '#F4EBE1'
  const inputColor = modal ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'
  const inputTextColor = modal ? '#ffffff' : '#111827'
  const inputPlaceholderClass = modal ? 'flex-1 bg-transparent text-base placeholder:text-white/40 outline-none' : 'flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 outline-none'

  return (
    <div
      className={modal ? 'w-full max-w-sm' : 'min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10 relative'}
      style={modal ? { fontFamily: interTight } : { fontFamily: interTight, backgroundColor: '#F4EBE1' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={modal
          ? { backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.15)' }
          : { backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }
        }
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
            <iconify-icon icon="solar:login-3-bold" width="24" className="text-white" />
          </div>
        </div>

        <h1 className="text-2xl text-center font-bold tracking-tight mb-1.5" style={{ fontFamily: interTight, color: modal ? '#ffffff' : '#111827' }}>{tr('login_title')}</h1>
        <p className="text-sm text-center mb-7" style={{ color: modal ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>{tr('login_subtitle')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: inputBg }}>
            <iconify-icon icon="solar:user-linear" width="18" style={{ color: inputColor, display: 'block' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              aria-label={tr('login_identifier')}
              placeholder={tr('login_identifier')}
              className={inputPlaceholderClass}
              style={{ color: inputTextColor }}
            />
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: inputBg }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: inputColor, display: 'block' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              aria-label="Password"
              placeholder="Password"
              className={inputPlaceholderClass}
              style={{ color: inputTextColor }}
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? tr('password_hide') : tr('password_show')} className="shrink-0 flex items-center" style={{ color: inputColor }}>
              <iconify-icon icon={showPassword ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width="18" />
            </button>
          </div>

          {onForgotPassword && (
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={onForgotPassword} className="text-xs font-semibold underline" style={{ color: modal ? 'rgba(255,255,255,0.7)' : '#f91814' }}>
                {tr('login_forgot_password')}
              </button>
            </div>
          )}

          {error === 'email not verified' ? (
            <div className="flex flex-col gap-2 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(249,24,20,0.08)' }}>
              <p style={{ color: '#f91814' }}>{tr('login_email_not_verified')}</p>
              {resendSent ? (
                <p style={{ color: '#16a34a' }}>{tr('resend_success')}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    autoComplete="email"
                    aria-label={tr('forgot_email_placeholder')}
                    placeholder={tr('forgot_email_placeholder')}
                    className="flex-1 bg-white rounded-lg px-2 py-1.5 outline-none"
                    style={{ color: '#111827', border: '1px solid rgba(0,0,0,0.1)' }}
                  />
                  <button type="button" onClick={handleResend} disabled={resending} className="shrink-0 px-2.5 py-1.5 rounded-lg font-semibold text-white" style={{ backgroundColor: '#3b82f6' }}>
                    {tr('login_resend')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            error && (
              <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>
                {error}
              </p>
            )
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {isPending ? tr('login_pending') : tr('login_cta')}
          </button>
        </form>

        {modal ? (
          <button
            onClick={onBack}
            className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80 mt-2 flex items-center justify-center gap-1.5"
            style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'transparent' }}
          >
            {tr('auth_back')}
          </button>
        ) : (
          <button
            onClick={onBack}
            className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80 mt-2 flex items-center justify-center gap-1.5"
            style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}
          >
            <iconify-icon icon="solar:arrow-left-linear" width="16" />
            {tr('auth_back')}
          </button>
        )}

        {onSwitchToRegister && (
          <p className="text-center text-xs mt-4" style={{ color: modal ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
            {tr('auth_no_account')}{' '}
            <button type="button" onClick={onSwitchToRegister} className="font-semibold underline" style={{ color: modal ? '#93c5fd' : '#f91814' }}>
              {tr('auth_register_link')}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
