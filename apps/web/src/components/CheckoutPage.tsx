import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'
import { useSubscription } from '../hooks/useSubscription'
import { PLANS_META, getPlanMeta } from '../lib/plans'

const bowlby = "'Bowlby One', system-ui"

function PlanPicker() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const PLANS = PLANS_META.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    priceNote: `/ ${lang === 'id' ? 'bulan' : 'mo'}`,
    desc: t(p.descKey),
    features: p.featureKeys.map((k) => t(k)),
    cta: t(p.ctaKey),
    highlight: p.highlight,
    oldPrice: p.oldPrice,
  }))

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-16"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <iconify-icon icon="solar:arrow-left-linear" width="16" />
        Back
      </button>

      <h1 className="text-4xl md:text-5xl mb-2 text-center tracking-tighter" style={{ fontFamily: bowlby, color: '#111827' }}>
        {lang === 'id' ? 'Pilih Paket' : 'Choose a Plan'}
      </h1>
      <p className="text-sm text-zinc-500 mb-10 text-center">
        {lang === 'id' ? 'Pilih paket yang sesuai untukmu.' : 'Pick the plan that fits you best.'}
      </p>

      <div className="w-full max-w-2xl">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-3xl overflow-hidden hover:-translate-y-1 transition-transform duration-300"
              style={{ backgroundColor: plan.highlight ? '#000000' : '#ffffff' }}
            >
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-lg font-semibold" style={{ color: plan.highlight ? '#ffffff' : '#111827' }}>{plan.name}</span>
                  {plan.highlight && (
                    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
                      {t('pricing_best_value')}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 flex-wrap mb-1">
                  <span className="font-bold" style={{ fontSize: '2.5rem', lineHeight: 1, color: plan.highlight ? '#ffffff' : '#111827' }}>{plan.price}</span>
                  <span className="text-sm ml-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>{plan.priceNote}</span>
                  {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: plan.highlight ? 'rgba(255,255,255,0.4)' : '#d1d5db' }}>{plan.oldPrice}</span>}
                </div>
                <p className="text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>{plan.desc}</p>
              </div>

              <div className="px-6 pb-5">
                <button
                  onClick={() => navigate(`/checkout?plan=${plan.slug}`)}
                  className="w-full py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                  style={plan.highlight
                    ? { backgroundColor: '#f91814', color: '#ffffff' }
                    : { backgroundColor: '#111827', color: '#ffffff' }
                  }
                >
                  {plan.cta}
                </button>
              </div>

              <ul className="flex flex-col gap-3 px-6 py-5 flex-1 border-t" style={{ borderColor: plan.highlight ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                    <iconify-icon
                      icon="solar:check-circle-linear"
                      width="15"
                      style={{ color: plan.highlight ? '#f91814' : '#9ca3af', flexShrink: 0, marginTop: '2px' }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramPlan = searchParams.get('plan')
  const expired = searchParams.get('expired') === '1'
  const { data: sub } = useSubscription()

  const notice = expired
    ? tr('checkout_expired_banner')
    : sub?.planSlug
      ? tr('checkout_current_plan').replace('{plan}', sub.planSlug)
      : null

  const noticeBar = notice ? (
    <div className="w-full text-center px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
      {notice}
    </div>
  ) : null

  if (!paramPlan) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }}>
        {noticeBar}
        <PlanPicker />
      </div>
    )
  }

  const planSlug = paramPlan
  const plan = getPlanMeta(planSlug) ?? getPlanMeta('starter')!

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }}>
      {noticeBar}
      <PaymentTrigger planSlug={planSlug} plan={plan} tr={tr} navigate={navigate} />
    </div>
  )
}

function PaymentTrigger({
  planSlug,
  plan,
  tr,
  navigate,
}: {
  planSlug: string
  plan: { name: string }
  tr: ReturnType<typeof useLanguage>['t']
  navigate: ReturnType<typeof useNavigate>
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

      // Dev simulation — the subscription is already activated server-side.
      if (data.simulated || !data.token) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        setIsDone(true)
        return
      }

      // Popup flow — load snap.js then open the Snap popup.
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
          // UX hint only — confirm via backend, then refresh the cache.
          void (async () => {
            await waitForActivePlan()
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            setIsDone(true)
          })()
        },
        onPending: () => { navigate(`/checkout/return?order_id=${data.orderId}&transaction_status=pending`) },
        onError: () => { setError(tr('checkout_payment_error')) },
        onClose: () => { navigate('/checkout') },
      })
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isDone) {
    return (
      <div
        className="min-h-screen flex items-center justify-center antialiased selection:bg-[#f91814] selection:text-white"
        style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
      >
        <div className="w-full max-w-sm mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:check-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>
            {tr('checkout_success_title')}
          </h1>
          <p className="text-sm text-zinc-500 mb-8">
            {plan.name} {tr('checkout_plan_active')} {tr('checkout_success_note')}
          </p>
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

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center antialiased px-4"
        style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:danger-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 mb-8">{error}</p>
          <button
            onClick={() => navigate('/checkout')}
            className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#111827' }}
          >
            {tr('auth_back')}
          </button>
        </div>
      </div>
    )
  }

  // Blank while Snap loads
  return <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }} />
}
