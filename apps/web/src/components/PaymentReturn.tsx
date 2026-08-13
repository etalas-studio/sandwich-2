import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'

const bowlby = "'Bowlby One', system-ui"

/**
 * Landing page after Midtrans redirect. The browser URL may carry
 * transaction_status for display only — the actual source of truth is the
 * backend subscription state (fulfillment is webhook-driven).
 */
export default function PaymentReturn() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'pending'>('loading')

  const displayedStatus = searchParams.get('transaction_status')

  const poll = React.useCallback(async () => {
    setStatus('loading')
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch(apiUrl('/api/subscriptions/active'), { credentials: 'include' })
        if (res.ok) {
          const s = await res.json() as { planSlug: string | null }
          if (s.planSlug) {
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            setStatus('success')
            return
          }
        }
      } catch { /* transient */ }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setStatus('pending')
  }, [queryClient])

  React.useEffect(() => {
    void poll()
  }, [poll])

  const wrapperStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
    backgroundColor: '#F4EBE1',
  } as const

  if (status === 'loading') {
    return <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }} />
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center antialiased px-4" style={wrapperStyle}>
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:check-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>
            {tr('checkout_success_title')}
          </h1>
          <p className="text-sm text-zinc-500 mb-8">{tr('checkout_success_note')}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#111827' }}
          >
            {tr('checkout_success_cta')}
          </button>
        </div>
      </div>
    )
  }

  // Pending / not-yet-confirmed (or failed) — never trust the URL param for fulfillment.
  const failed = displayedStatus === 'deny' || displayedStatus === 'cancel' || displayedStatus === 'expire' || displayedStatus === 'failure'
  return (
    <div className="min-h-screen flex items-center justify-center antialiased px-4" style={wrapperStyle}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: failed ? '#f91814' : '#111827' }}>
            <iconify-icon icon={failed ? 'solar:danger-triangle-bold' : 'solar:clock-circle-bold'} width="28" className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>
          {failed ? tr('checkout_failed_title') : tr('checkout_pending_title')}
        </h1>
        <p className="text-sm text-zinc-500 mb-8">
          {failed ? tr('checkout_failed_note') : tr('checkout_pending_note')}
        </p>
        <div className="flex flex-col gap-2">
          {!failed && (
            <button
              onClick={() => void poll()}
              className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#111827' }}
            >
              {tr('checkout_retry')}
            </button>
          )}
          <button
            onClick={() => navigate('/checkout')}
            className="px-6 py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80"
            style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}
          >
            {tr('auth_back')}
          </button>
        </div>
      </div>
    </div>
  )
}
