import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { postForgotPassword } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function ForgotPasswordPage() {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('forgot_title')}</h1>
        <p className="text-sm text-zinc-500 text-center mb-7">{tr('forgot_subtitle')}</p>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('forgot_success')}</p>
            <button onClick={() => router.push('/')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
              <iconify-icon icon="solar:letter-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus aria-label="Email" placeholder={tr('forgot_email_placeholder')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
            </div>
            {error && <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{error}</p>}
            <button type="submit" disabled={pending} className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2" style={{ backgroundColor: '#0a0a0a' }}>{tr('forgot_submit')}</button>
            <button type="button" onClick={() => router.push('/')} className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80" style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}>{tr('auth_back')}</button>
          </form>
        )}
      </div>
    </div>
  )
}
