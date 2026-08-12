import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>
  error: string | null
  isPending: boolean
  onBack: () => void
  onSwitchToRegister?: () => void
}

export default function LoginForm({ onSubmit, error, isPending, onBack, onSwitchToRegister }: LoginFormProps) {
  const { t: tr } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit(username, password)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10 relative"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
            <iconify-icon icon="solar:login-3-bold" width="24" className="text-white" />
          </div>
        </div>

        <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('login_title')}</h1>
        <p className="text-sm text-zinc-500 text-center mb-7">{tr('login_subtitle')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:user-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              aria-label="Username"
              placeholder="Username"
              className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Password"
              placeholder="Password"
              className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none"
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} className="shrink-0 flex items-center" style={{ color: 'rgba(0,0,0,0.35)' }}>
              <iconify-icon icon={showPassword ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width="18" />
            </button>
          </div>

          {error && (
            <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ backgroundColor: '#0a0a0a' }}
          >
            {isPending ? tr('login_pending') : tr('login_cta')}
          </button>
        </form>

        <button
          onClick={onBack}
          className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80 mt-2 flex items-center justify-center gap-1.5"
          style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}
        >
          <iconify-icon icon="solar:arrow-left-linear" width="16" />
          {tr('auth_back')}
        </button>

        {onSwitchToRegister && (
          <p className="text-center text-xs text-zinc-400 mt-4">
            {tr('auth_no_account')}{' '}
            <button type="button" onClick={onSwitchToRegister} className="font-semibold underline" style={{ color: '#f91814' }}>
              {tr('auth_register_link')}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
