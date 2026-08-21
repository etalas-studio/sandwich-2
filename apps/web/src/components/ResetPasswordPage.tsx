import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { postResetPassword } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function ResetPasswordPage() {
  const { t: tr } = useLanguage()
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!token || !password || password !== confirm) {
      setError(tr('reset_mismatch'))
      return
    }
    setPending(true)
    setError(null)
    try {
      await postResetPassword(token, password)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
          <p className="text-sm text-center rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('reset_success')}</p>
          <button onClick={() => router.push('/')} className="w-full mt-4 py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('reset_title')}</h1>
        <p className="text-sm text-zinc-500 text-center mb-7">{tr('reset_subtitle')}</p>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" aria-label="New password" placeholder={tr('reset_new_password')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" aria-label="Confirm password" placeholder={tr('reset_confirm_password')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
          </div>
          {error && <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{error}</p>}
          <button type="submit" disabled={pending} className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2" style={{ backgroundColor: '#0a0a0a' }}>{tr('reset_submit')}</button>
          <button type="button" onClick={() => router.push('/')} className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80" style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}>{tr('auth_back')}</button>
        </form>
      </div>
    </div>
  )
}
