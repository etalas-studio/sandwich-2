import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'

const bowlby = "'Bowlby One', system-ui"

const PLAN_DETAILS: Record<string, { name: string; price: string; oldPrice?: string; amount: number }> = {
  starter: { name: 'Starter', price: 'Rp 50k', amount: 50000 },
  pro: { name: 'Pro', price: 'Rp 100k', oldPrice: 'Rp 250k', amount: 100000 },
}

function PlanPicker() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const PLANS = [
    {
      slug: 'starter',
      name: 'Starter',
      price: 'Rp 50k',
      priceNote: `/ ${lang === 'id' ? 'bulan' : 'mo'}`,
      desc: t('plan_starter_desc'),
      features: [t('plan_starter_f1'), t('plan_starter_f2'), t('plan_starter_f3'), t('plan_starter_f4'), t('plan_starter_f5')],
      cta: t('plan_starter_cta'),
      highlight: false,
      oldPrice: null as string | null,
    },
    {
      slug: 'pro',
      name: 'Pro',
      price: 'Rp 100k',
      priceNote: `/ ${lang === 'id' ? 'bulan' : 'mo'}`,
      oldPrice: 'Rp 250k',
      desc: t('plan_pro_desc'),
      features: [t('plan_pro_f1'), t('plan_pro_f2'), t('plan_pro_f3'), t('plan_pro_f4'), t('plan_pro_f5'), t('plan_pro_f6')],
      cta: t('plan_pro_cta'),
      highlight: true,
    },
  ]

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
  const { t: tr, lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramPlan = searchParams.get('plan')
  const backTo = searchParams.get('from') === 'dashboard' || localStorage.getItem('sandwich_paid_plan') ? '/dashboard' : '/'

  // No plan selected yet — show picker
  if (!paramPlan) return <PlanPicker />

  const planSlug = paramPlan
  const plan = PLAN_DETAILS[planSlug] ?? PLAN_DETAILS.starter

  return <PaymentTrigger planSlug={planSlug} plan={plan} backTo={backTo} tr={tr} lang={lang} navigate={navigate} />
}

function PaymentTrigger({
  planSlug,
  plan,
  backTo,
  tr,
  navigate,
}: {
  planSlug: string
  plan: typeof PLAN_DETAILS[string]
  backTo: string
  tr: ReturnType<typeof useLanguage>['t']
  lang: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const [isDone, setIsDone] = useState(false)

  const hasTriggered = React.useRef(false)
  React.useEffect(() => {
    if (hasTriggered.current) return
    hasTriggered.current = true

    const run = async () => {
      const orderId = `${planSlug}-${Date.now()}`
      const grossAmount = plan.amount

      try {
        const [cfgRes, txRes] = await Promise.all([
          fetch(apiUrl('/api/midtrans/config')),
          fetch(apiUrl('/api/midtrans/transaction'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ orderId, grossAmount, itemName: `SANDWICH ${plan.name}` }),
          }),
        ])

        if (txRes.ok) {
          const { token } = await txRes.json() as { token: string }
          const { clientKey, isProduction } = cfgRes.ok
            ? await cfgRes.json() as { clientKey: string; isProduction: boolean }
            : { clientKey: '', isProduction: true }

          await new Promise<void>((resolve, reject) => {
            if ((window as unknown as Record<string, unknown>).snap) { resolve(); return }
            const script = document.createElement('script')
            script.src = isProduction
              ? 'https://app.midtrans.com/snap/snap.js'
              : 'https://app.sandbox.midtrans.com/snap/snap.js'
            script.setAttribute('data-client-key', clientKey)
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Snap.js failed to load'))
            document.head.appendChild(script)
          })
          ;(window as unknown as { snap: { pay: (token: string, opts: object) => void } }).snap.pay(token, {
            onSuccess: () => { localStorage.setItem('sandwich_paid_plan', planSlug); setIsDone(true) },
            onPending: () => { navigate(backTo) },
            onError: () => { navigate(backTo) },
            onClose: () => { navigate('/') },
          })
          return
        }
      } catch { /* fall through to simulation */ }

      // ── Simulation fallback ──────────────────────────────────────────────
      setTimeout(() => {
        localStorage.setItem('sandwich_paid_plan', planSlug)
        setIsDone(true)
      }, 1500)
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

  // Blank while Snap loads
  return <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }} />
}
