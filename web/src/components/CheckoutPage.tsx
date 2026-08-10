import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

const PLAN_DETAILS: Record<string, { name: string; price: string; oldPrice?: string; desc_en: string; desc_id: string }> = {
  starter: { name: 'Starter', price: 'Rp 50k', desc_en: 'For those getting serious.', desc_id: 'Buat yang mulai serius.' },
  pro: { name: 'Pro', price: 'Rp 100k', oldPrice: 'Rp 250k', desc_en: 'Unlimited, full access.', desc_id: 'Unlimited, semua akses.' },
}

const PAYMENT_METHOD_KEYS = [
  { id: 'qris', labelKey: 'checkout_method_qris' as const, icon: 'solar:qr-code-linear' },
  { id: 'card', labelKey: 'checkout_method_card' as const, icon: 'solar:card-linear' },
  { id: 'va', labelKey: 'checkout_method_va' as const, icon: 'solar:wallet-linear' },
]

const PLAN_FEATURES: Record<string, { en: string[]; id: string[] }> = {
  starter: {
    en: ['Premium AI model', '5 PRDs / month', 'AI chat (100×/mo)', 'Download Markdown', 'Generate specs & tasks'],
    id: ['Premium AI model', '5 PRD / bulan', 'Chat AI (100×/bln)', 'Download Markdown', 'Generate specs & task'],
  },
  pro: {
    en: ['Premium AI model', 'Unlimited PRDs', 'AI chat (unlimited)', 'Download Markdown', 'Direct chat with Etalas team', 'Generate specs & tasks'],
    id: ['Premium AI model', 'Unlimited PRD', 'Chat AI (unlimited)', 'Download Markdown', 'Chat langsung dengan tim Etalas', 'Generate specs & task'],
  },
}

export default function CheckoutPage() {
  const { t: tr, lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramPlan = searchParams.get('plan')
  const backTo = searchParams.get('from') === 'dashboard' || localStorage.getItem('sandwich_paid_plan') ? '/dashboard' : '/'

  // If no plan param, show plan picker first
  const [selectedPlan, setSelectedPlan] = useState<string | null>(paramPlan)
  const planSlug = selectedPlan ?? 'starter'
  const plan = PLAN_DETAILS[planSlug] ?? PLAN_DETAILS.starter
  const planDesc = lang === 'id' ? plan.desc_id : plan.desc_en

  const [method, setMethod] = useState(PAYMENT_METHOD_KEYS[0].id)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDone, setIsDone] = useState(false)

  // Plan picker screen
  if (!selectedPlan) {
    return (
      <div
        className="min-h-screen flex items-center justify-start sm:justify-center antialiased selection:bg-[#f91814] selection:text-white px-4 py-10 sm:py-0 overflow-y-auto"
        style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
      >
        <div className="w-full max-w-2xl py-4 sm:py-16">
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors mb-8"
          >
            <iconify-icon icon="solar:arrow-left-linear" width="14" />
            {tr('auth_back')}
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
              <span className="text-white font-black text-xs" style={{ fontFamily: bowlby }}>S</span>
            </div>
            <h1 className="text-2xl tracking-tight" style={{ fontFamily: bowlby, color: '#111827' }}>
              {lang === 'id' ? 'Pilih Paket' : 'Choose a Plan'}
            </h1>
          </div>
          <p className="text-sm text-zinc-500 mb-8">
            {lang === 'id' ? 'Pilih paket yang sesuai kebutuhanmu.' : 'Pick the plan that fits your needs.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(PLAN_DETAILS).map(([slug, p]) => {
              const features = PLAN_FEATURES[slug]?.[lang] ?? PLAN_FEATURES[slug]?.en ?? []
              const isPro = slug === 'pro'
              return (
                <button
                  key={slug}
                  onClick={() => setSelectedPlan(slug)}
                  className="flex flex-col text-left rounded-3xl p-6 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: isPro ? '#111827' : '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: isPro ? '2px solid #f91814' : '2px solid transparent' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold" style={{ color: isPro ? '#fff' : '#111827' }}>{p.name}</span>
                    {isPro && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f91814', color: '#fff' }}>
                        {tr('pricing_best_value')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-3xl font-black" style={{ color: isPro ? '#fff' : '#111827', fontFamily: bowlby }}>{p.price}</span>
                    {p.oldPrice && <span className="text-xs line-through" style={{ color: isPro ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{p.oldPrice}</span>}
                  </div>
                  <p className="text-xs mb-5" style={{ color: isPro ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>
                    {lang === 'id' ? p.desc_id : p.desc_en} {tr('checkout_price_per_month')}
                  </p>
                  <div className="flex flex-col gap-2 mb-6">
                    {features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <iconify-icon icon="solar:check-circle-bold" width="14" style={{ color: isPro ? '#f91814' : '#10b981', flexShrink: 0 }} />
                        <span className="text-xs" style={{ color: isPro ? 'rgba(255,255,255,0.7)' : '#374151' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="w-full py-3 rounded-full text-sm font-semibold text-center mt-auto"
                    style={{ backgroundColor: isPro ? '#f91814' : '#111827', color: '#fff' }}
                  >
                    {lang === 'id' ? (isPro ? 'Pilih Pro' : 'Pilih Starter') : (isPro ? 'Choose Pro' : 'Choose Starter')}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const handlePay = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setIsDone(true)
      localStorage.setItem('sandwich_paid_plan', planSlug)
    }, 1500)
  }

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

  return (
    <div
      className="min-h-screen flex items-center justify-start sm:justify-center antialiased selection:bg-[#f91814] selection:text-white px-4 py-10 sm:py-0 overflow-y-auto"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      <div className="w-full max-w-sm py-4 sm:py-16">
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors mb-6"
        >
          <iconify-icon icon="solar:arrow-left-linear" width="14" />
          {tr('auth_back')}
        </button>

        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
            <span className="text-white font-black text-xs" style={{ fontFamily: bowlby }}>S</span>
          </div>
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('checkout_title')}</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-8">{tr('checkout_subtitle')}</p>

        {/* Order summary */}
        <div className="rounded-3xl px-5 py-4 mb-6" style={{ backgroundColor: '#111827' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white">{tr('checkout_plan_label')} {plan.name}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-white">{plan.price}</span>
              {plan.oldPrice && <span className="text-xs line-through" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.oldPrice}</span>}
            </div>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{planDesc} {tr('checkout_price_per_month')}</p>
        </div>

        {/* Payment method */}
        <p className="text-xs font-medium text-zinc-500 mb-2.5">{tr('checkout_payment_method')}</p>
        <div className="flex flex-col gap-2.5 mb-8">
          {PAYMENT_METHOD_KEYS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm text-left transition-colors bg-white"
              style={{
                border: `1.5px solid ${method === m.id ? '#f91814' : '#f3f4f6'}`,
              }}
            >
              <iconify-icon icon={m.icon} width="18" style={{ color: '#6b7280' }} />
              <span className="flex-1 font-medium" style={{ color: '#111827' }}>{tr(m.labelKey)}</span>
              <div
                className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                style={{ borderColor: method === m.id ? '#f91814' : '#d1d5db' }}
              >
                {method === m.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f91814' }} />}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#f91814' }}
        >
          {isProcessing ? tr('checkout_processing') : `${tr('checkout_pay_cta')} ${plan.price}`}
        </button>

        <p className="text-[11px] text-zinc-400 text-center mt-4">
          {tr('checkout_simulation_note')}
        </p>
      </div>
    </div>
  )
}
