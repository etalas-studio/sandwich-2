import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'
import { getPayment, verifyPayment } from '../api/payments'
import { extractInstructions, type PaymentInstruction } from '../lib/paymentInstructions'

const bowlby = "'Bowlby One', system-ui"

/**
 * Landing page after Midtrans redirect. The browser URL may carry
 * transaction_status for display only — the actual source of truth is the
 * backend subscription state (fulfillment is webhook-driven).
 */
export default function PaymentReturn() {
  const { t: tr } = useLanguage()
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const displayedStatus = searchParams.get('transaction_status')
  const [status, setStatus] = useState<'loading' | 'success' | 'pending'>('loading')
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([])

  const refresh = React.useCallback(async () => {
    setStatus('loading')

    // 0) Confirm with the provider directly (the webhook can't reach localhost).
    if (orderId) {
      try { await verifyPayment(orderId) } catch { /* ignore */ }
    }

    // 1) Subscription state is the source of truth for fulfillment.
    let active = false
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch(apiUrl('/api/subscriptions/active'), { credentials: 'include' })
        if (res.ok) {
          const s = await res.json() as { planSlug: string | null }
          if (s.planSlug) {
            active = true
            break
          }
        }
      } catch { /* transient */ }
      await new Promise((r) => setTimeout(r, 1500))
    }

    // 2) Recover pending payment instructions (VA number / QR / payment code).
    if (orderId) {
      try {
        const payment = await getPayment(orderId)
        setInstructions(extractInstructions(payment.providerData))
      } catch {
        setInstructions([])
      }
    }

    if (active) {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      setStatus('success')
    } else {
      setStatus('pending')
    }
  }, [orderId, queryClient])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

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
            onClick={() => router.push('/dashboard')}
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
    <div className="min-h-screen flex items-center justify-center antialiased px-4 py-10" style={wrapperStyle}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: failed ? '#f91814' : '#111827' }}>
            <iconify-icon icon={failed ? 'solar:danger-triangle-bold' : 'solar:clock-circle-bold'} width="28" className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>
          {failed ? tr('checkout_failed_title') : tr('checkout_pending_title')}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          {failed ? tr('checkout_failed_note') : tr('checkout_pending_note')}
        </p>

        {!failed && instructions.length > 0 && (
          <div className="text-left rounded-2xl p-4 mb-6" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#f91814' }}>{tr('checkout_instructions')}</p>
            <div className="flex flex-col gap-2">
              {instructions.map((ins) => (
                <div key={ins.label + ins.value} className="flex items-center justify-between gap-3">
                  <span className="text-xs" style={{ color: '#9ca3af' }}>{ins.label}</span>
                  <span className="text-sm font-mono font-semibold break-all text-right" style={{ color: '#111827' }}>{ins.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {!failed && (
            <button
              onClick={() => void refresh()}
              className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#111827' }}
            >
              {tr('checkout_retry')}
            </button>
          )}
          <button
            onClick={() => router.push('/pay')}
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
