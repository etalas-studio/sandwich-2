// apps/web/src/components/PaymentPage.tsx
import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'
import { verifyPayment } from '../api/payments'
import { useSubscription } from '../hooks/useSubscription'
import { getPlanMeta } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'

const bowlby = "'Bowlby One', system-ui"

export default function PaymentPage() {
  const { t: tr } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramPlan = searchParams.get('plan')
  const expired = searchParams.get('expired') === '1'
  const { data: sub } = useSubscription()

  useEffect(() => {
    if (!paramPlan) router.replace('/')
  }, [paramPlan, router])

  if (!paramPlan) return null

  const planSlug = paramPlan
  const plan = getPlanMeta(planSlug) ?? getPlanMeta('starter')!

  const notice = expired
    ? tr('checkout_expired_banner')
    : sub?.planSlug
      ? tr('checkout_current_plan').replace('{plan}', sub.planSlug)
      : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }}>
      {notice && (
        <div className="w-full text-center px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
          {notice}
        </div>
      )}
      <PaymentTrigger planSlug={planSlug} plan={plan} tr={tr} router={router} />
    </div>
  )
}

function PaymentTrigger({
  planSlug,
  plan,
  tr,
  router,
}: {
  planSlug: string
  plan: { name: string; amount: number }
  tr: ReturnType<typeof useLanguage>['t']
  router: ReturnType<typeof useRouter>
}) {
  const queryClient = useQueryClient()
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waitForActivePlan = async (): Promise<boolean> => {
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(apiUrl('/api/subscriptions/active'), { credentials: 'include' })
        if (res.ok) {
          const s = await res.json() as { planSlug: string | null }
          if (s.planSlug) return true
        }
      } catch { /* transient */ }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return false
  }

  const hasTriggered = React.useRef(false)
  React.useEffect(() => {
    if (hasTriggered.current) return
    hasTriggered.current = true

    const run = async () => {
      trackPostHog('checkout_started', { plan_slug: planSlug })

      let txRes: Response
      try {
        txRes = await fetch(apiUrl('/api/midtrans/transaction'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ planSlug }),
        })
      } catch {
        setError(tr('checkout_payment_error'))
        return
      }

      if (!txRes.ok) {
        setError(tr('checkout_payment_error'))
        return
      }

      const data = await txRes.json() as {
        token: string | null
        simulated: boolean
        orderId: string
        clientKey: string
        isProduction: boolean
      }

      if (data.simulated || !data.token) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        setIsDone(true)
        return
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const w = window as unknown as Record<string, unknown>
          if (w.snap) { resolve(); return }
          const script = document.createElement('script')
          script.src = data.isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js'
          script.setAttribute('data-client-key', data.clientKey)
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Snap.js failed to load'))
          document.head.appendChild(script)
        })
      } catch {
        setError(tr('checkout_payment_error'))
        return
      }

      ;(window as unknown as { snap: { pay: (token: string, opts: Record<string, unknown>) => void } }).snap.pay(data.token, {
        onSuccess: () => {
          void (async () => {
            try {
              try { await verifyPayment(data.orderId) } catch { /* ignore */ }
              const activated = await waitForActivePlan()
              if (!activated) {
                setError(tr('checkout_payment_error'))
                return
              }
              queryClient.invalidateQueries({ queryKey: ['subscription'] })
              trackPostHog('payment_succeeded', { plan_slug: planSlug, order_id: data.orderId })
              trackPostHog('subscription_activated', { plan_slug: planSlug })
              setIsDone(true)
            } catch {
              setError(tr('checkout_payment_error'))
            }
          })()
        },
        onPending: () => { router.push(`/pay/return?order_id=${data.orderId}&transaction_status=pending`) },
        onError: () => { trackPostHog('payment_failed', { plan_slug: planSlug }); setError(tr('checkout_payment_error')) },
        onClose: () => { router.push('/dashboard') },
      })
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isDone) {
    return (
      <div className="min-h-screen flex items-center justify-center antialiased" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:check-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('checkout_success_title')}</h1>
          <p className="text-sm text-zinc-500 mb-8">{plan.name} {tr('checkout_plan_active')} {tr('checkout_success_note')}</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: '#111827' }}>
            {tr('checkout_success_cta')}
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center antialiased px-4" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:danger-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 mb-8">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: '#111827' }}>
            {tr('auth_back')}
          </button>
        </div>
      </div>
    )
  }

  return <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }} />
}
