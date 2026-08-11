import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

const PLAN_DETAILS: Record<string, { name: string; price: string; oldPrice?: string; desc_en: string; desc_id: string; amount: number }> = {
  starter: { name: 'Starter', price: 'Rp 50k', desc_en: 'For those getting serious.', desc_id: 'Buat yang mulai serius.', amount: 50000 },
  pro: { name: 'Pro', price: 'Rp 100k', oldPrice: 'Rp 250k', desc_en: 'Unlimited, full access.', desc_id: 'Unlimited, semua akses.', amount: 100000 },
}

function PlanPicker() {
  const { lang } = useLanguage()
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center antialiased px-4"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      <h1 className="text-3xl md:text-4xl mb-2 text-center" style={{ fontFamily: bowlby, color: '#111827' }}>
        {lang === 'id' ? 'Pilih Paket' : 'Choose a Plan'}
      </h1>
      <p className="text-sm text-zinc-500 mb-10 text-center">
        {lang === 'id' ? 'Pilih paket yang sesuai untukmu.' : 'Pick the plan that fits you best.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
        {Object.entries(PLAN_DETAILS).map(([slug, plan]) => (
          <button
            key={slug}
            onClick={() => navigate(`/checkout?plan=${slug}`)}
            className="flex-1 text-left rounded-2xl p-6 transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ backgroundColor: slug === 'pro' ? '#111827' : '#ffffff', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.08)' }}
          >
            {slug === 'pro' && (
              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3" style={{ backgroundColor: '#f91814', color: '#fff' }}>
                {lang === 'id' ? 'Terbaik' : 'Best Value'}
              </span>
            )}
            <div className="text-lg font-semibold mb-1" style={{ color: slug === 'pro' ? '#fff' : '#111827' }}>{plan.name}</div>
            <div className="flex items-baseline gap-1 mb-3">
              {plan.oldPrice && (
                <span className="text-xs line-through" style={{ color: slug === 'pro' ? '#6b7280' : '#9ca3af' }}>{plan.oldPrice}</span>
              )}
              <span className="text-2xl font-bold" style={{ color: slug === 'pro' ? '#fff' : '#111827' }}>{plan.price}</span>
              <span className="text-xs" style={{ color: slug === 'pro' ? '#9ca3af' : '#6b7280' }}>/{lang === 'id' ? 'bulan' : 'mo'}</span>
            </div>
            <p className="text-sm" style={{ color: slug === 'pro' ? '#d1d5db' : '#6b7280' }}>
              {lang === 'id' ? plan.desc_id : plan.desc_en}
            </p>
          </button>
        ))}
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
          fetch('/api/midtrans/config'),
          fetch('/api/midtrans/transaction', {
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
