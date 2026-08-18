import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'
import { postVerifyEmail } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function VerifyEmailPage() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    postVerifyEmail(token)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl tracking-tight mb-4" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('verify_title')}</h1>
        {state === 'loading' && <p className="text-sm text-zinc-500">Loading…</p>}
        {state === 'success' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('verify_success')}</p>
            <button onClick={() => navigate('/login')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        )}
        {state === 'error' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{tr('verify_invalid')}</p>
            <button onClick={() => navigate('/')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
