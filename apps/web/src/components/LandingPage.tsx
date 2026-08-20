'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createConversationLocal } from '../lib/conversations'
import { createMessage } from '../api/conversations'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../lib/i18n'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'

import { FAQS } from '../lib/faqs'

const bowlby = "'Bowlby One', system-ui"
const mousememoirs = "'Mouse Memoirs', sans-serif"

export default function LandingPage() {
  const { lang, setLang, t } = useLanguage()
  const { state: authState } = useAuth()
  const router = useRouter()
  const PLANS = PLANS_META.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.price,
    priceNote: p.amount === 0 ? '' : `/ ${lang === 'id' ? 'bulan' : 'mo'}`,
    desc: t(p.descKey),
    features: p.featureKeys.map((k) => t(k)),
    cta: t(p.ctaKey),
    highlight: p.highlight,
    oldPrice: p.oldPrice,
  }))
  const [prompt, setPrompt] = useState('')
  const [pendingType, setPendingType] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const activeSectionRef = useRef<string>('')
  const [activeSectionState, setActiveSectionState] = useState<string>('')

  useEffect(() => {
    if (window.location.hash === '#pricing') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const ids = ['harnesses', 'pipeline', 'pricing', 'faq']
    const observers = ids.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            activeSectionRef.current = id
            setActiveSectionState(id)
          }
        },
        { threshold: 0.3 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    if (authState.status !== 'authenticated') {
      try {
        localStorage.setItem('sandwich_draft', JSON.stringify({ prompt, activeType: pendingType || undefined }))
      } catch { /* best-effort draft save, e.g. storage quota */ }
      router.push('/register')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const local = await createConversationLocal({ type: 'general', pendingType: pendingType || undefined, summary: prompt.trim(), description: prompt.trim() })
      await createMessage(local.id, { content: prompt.trim() })
      // Hand off to the dashboard with the new session already auto-running.
      try {
        localStorage.setItem('sandwich_last_chat', JSON.stringify({ prompt: prompt.trim(), conversationId: local.id, autoRun: true }))
      } catch { /* ignore storage errors */ }
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'active subscription required') {
        // Already logged in but out of quota — stash the draft and send to checkout,
        // not /register (which would just bounce an authenticated user to /dashboard).
        try { localStorage.setItem('sandwich_draft', JSON.stringify({ prompt, activeType: pendingType || undefined })) } catch { /* ignore */ }
        router.push('/pay?plan=pro')
        return
      }
      setError(msg || t('hero_error_generic'))
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden selection:bg-[#f91814] selection:text-white text-zinc-800 antialiased"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      {/* ── NAV ── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-full border max-w-full"
          style={{
            backgroundColor: '#F4EBE1',
            borderColor: 'rgba(0,0,0,0.1)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-1" style={{ backgroundColor: '#f91814' }}>
            <span className="text-white font-black text-[10px]" style={{ fontFamily: bowlby }}>S</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {[
              { id: 'harnesses', label: t('nav_how') },
              { id: 'pipeline', label: t('nav_pipeline') },
              { id: 'pricing', label: t('nav_pricing') },
              { id: 'faq', label: t('nav_faq') },
            ].map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  activeSectionRef.current = id
                  setActiveSectionState(id)
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={{ color: activeSectionState === id ? '#0a0a0a' : '#6b7280', fontWeight: activeSectionState === id ? 600 : 500 }}
              >
                {label}
              </a>
            ))}
          </div>
          <button
            onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            className="shrink-0 ml-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: '#0a0a0a' }}
            title="Switch language"
          >
            {lang === 'en' ? 'EN' : 'ID'}
          </button>
          <button
            onClick={() => router.push('/login')}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f91814'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#f91814' }}
            className="shrink-0 ml-1 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
            style={{ backgroundColor: 'transparent', color: '#f91814', outline: '1.5px solid #f91814', outlineOffset: '-1.5px' }}
          >
            {t('nav_login')}
          </button>
          <button
            onClick={() => router.push('/register')}
            className="shrink-0 ml-1 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
            style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
          >
            {t('nav_get_started')}
          </button>
        </nav>
      </div>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 flex flex-col items-center text-center px-6 overflow-hidden">
        {/* watermark */}
        <div className="absolute inset-0 flex items-center justify-center z-0 opacity-5 pointer-events-none select-none">
          <span className="text-[25vw] leading-none text-[#F4A804]" style={{ fontFamily: bowlby }}>
            SANDWICH
          </span>
        </div>

        <h1
          className="relative z-10 text-5xl md:text-7xl leading-none text-[#f91814] tracking-tighter max-w-5xl mx-auto drop-shadow-sm"
          style={{ fontFamily: bowlby }}
        >
          SANDWICH
        </h1>

        <p
          className="relative z-10 text-2xl md:text-4xl tracking-tight mt-6 text-[#F4A804]"
          style={{ fontFamily: mousememoirs }}
        >
          {t('hero_tagline')}
        </p>

        {/* sandwich image */}
        <div className="relative w-full max-w-xs mt-12 mb-8 z-10">
          <img
            src="/sandwich.webp"
            alt="sandwich"
            className="w-full h-auto drop-shadow-2xl hover:scale-[1.02] transition-transform duration-700 object-contain"
          />
        </div>

        {/* prompt box */}
        <div className="w-full max-w-xl mx-auto mt-0 z-10">
          <>

              <div
                className="relative rounded-xl overflow-hidden shadow-lg"
                style={{ backgroundColor: '#111113' }}
              >
                {/* deliverable selector */}
                <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                  <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('hero_prompt_placeholder')}
                  rows={4}
                  className="w-full resize-none bg-transparent text-white text-sm outline-none px-5 pt-3 pb-2 leading-relaxed placeholder:text-white/30"
                />

                <div className="flex items-center justify-between px-4 pb-4 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>⌘↵</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting || !prompt.trim()}
                      className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:opacity-80 disabled:opacity-50 active:scale-95"
                      style={{ backgroundColor: '#f91814' }}
                    >
                      {isSubmitting
                        ? <iconify-icon icon="solar:refresh-linear" width="15" style={{ color: '#ffffff' }} className="animate-spin" />
                        : <iconify-icon icon="solar:arrow-up-linear" width="15" style={{ color: '#ffffff' }} />}
                    </button>
                  </div>
                </div>
              </div>

              {error && <p className="mt-2 text-xs text-center" style={{ color: '#f91814' }}>{error}</p>}
          </>
        </div>

      </section>

      {/* ── HARNESSES / HOW IT WORKS ── */}
      <section id="harnesses" className="py-24 md:py-32 relative overflow-hidden bg-[#f91814]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p
              className="text-xl md:text-2xl tracking-tight mb-4 uppercase text-white"
              style={{ fontFamily: mousememoirs }}
            >
              {t('harnesses_kicker')}
            </p>
            <h2
              className="text-4xl md:text-5xl tracking-tighter leading-tight text-white mb-6"
              style={{ fontFamily: bowlby }}
            >
              {t('harnesses_title')}
            </h2>
            <p className="max-w-lg mx-auto text-white/80 text-sm font-medium tracking-tight leading-relaxed">
              {t('harnesses_desc')}
            </p>
          </div>

          <div className="flex flex-wrap md:flex-nowrap flex-row items-center justify-center gap-6 md:gap-10 mt-8">
            {/* Left — output types */}
            <div className="flex flex-row md:flex-col gap-4 md:gap-10 items-start shrink-0 text-xs uppercase tracking-tight font-medium text-white order-2 md:order-1 basis-full md:basis-auto justify-center md:justify-start">
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-10deg)' }}>
                <iconify-icon icon="solar:document-text-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>PRD</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-5deg)' }}>
                <iconify-icon icon="solar:notes-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Specs</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(4deg)' }}>
                <iconify-icon icon="solar:widget-2-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Prototype</span>
              </div>
            </div>

            {/* Center — spec illustration */}
            <div className="flex items-center justify-center w-full max-w-sm md:w-96 shrink-0 order-1 md:order-2">
              <img
                src="/spec-illustration.png"
                alt="SPEC"
                className="w-full h-auto hover:scale-[1.02] transition-transform duration-700 object-contain"
              />
            </div>

            {/* Right — output types */}
            <div className="flex flex-row md:flex-col gap-4 md:gap-10 items-start shrink-0 text-xs uppercase tracking-tight font-medium text-white order-3 basis-full md:basis-auto justify-center md:justify-start">
              <div className="flex items-center gap-3" style={{ transform: 'rotate(10deg)' }}>
                <iconify-icon icon="solar:pen-new-square-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>{t('right_write_spec')}</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(5deg)' }}>
                <iconify-icon icon="solar:list-check-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>{t('right_structure_brief')}</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-4deg)' }}>
                <iconify-icon icon="solar:money-bag-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>{t('right_quotation')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE ── */}
      <section id="pipeline" className="py-24 md:py-32 bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-2xl tracking-tight mb-4 uppercase text-[#f91814]" style={{ fontFamily: mousememoirs }}>{t('pipeline_kicker')}</p>
          <h2 className="text-4xl md:text-6xl tracking-tighter leading-tight text-white mb-8" style={{ fontFamily: bowlby }}>
            {t('pipeline_title_l1')}<br />{t('pipeline_title_l2')}
          </h2>
          <p className="text-sm text-white/60 font-medium leading-relaxed tracking-tight max-w-lg">
            {t('pipeline_desc_1')}{' '}
            <a href="https://github.com/obra/superpowers" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4 hover:text-[#f91814] transition-colors">Superpowers by Obra</a>.
            {' '}{t('pipeline_desc_2')}
          </p>
          <div className="flex items-center gap-4 mt-12">
            <span className="text-sm font-bold uppercase tracking-widest text-white">SANDWICH</span>
            <span className="text-white/30">→</span>
            <a href="https://github.com/obra/superpowers" target="_blank" rel="noreferrer" className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">Superpowers</a>
          </div>
          <div className="mt-12">
            <button
              onClick={() => router.push('/register')}
              className="inline-flex items-center gap-2 bg-[#f91814] text-white px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight hover:bg-red-700 transition-colors shadow-md shadow-red-500/20"
            >
              {t('pipeline_cta')}
              <iconify-icon icon="solar:arrow-right-up-linear" style={{strokeWidth: 1.5}}></iconify-icon>
            </button>
          </div>
        </div>
      </section>

      {/* ── STACK / INGREDIENTS ── */}
      <section id="about" className="py-24 md:py-32 bg-[#F4EBE1]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <p className="text-2xl tracking-tight mb-4 uppercase text-[#f91814]" style={{ fontFamily: mousememoirs }}>
            {t('stack_kicker')}
          </p>
          <h2 className="text-4xl md:text-6xl tracking-tighter leading-tight mb-6 text-black" style={{ fontFamily: bowlby }}>
            {t('stack_title')}
          </h2>
          <p className="max-w-lg mx-auto text-black/50 mb-16 text-sm font-medium tracking-tight leading-relaxed">
            {t('stack_desc')}
          </p>
          <div className="grid grid-cols-2 md:flex md:flex-row justify-center items-start gap-x-6 gap-y-10 md:gap-24">
            {[
              { img: '/ingredients/tomato.webp', name: 'PRD', desc: t('stack_order_desc'), offset: false },
              { img: '/ingredients/cheese.webp', name: 'Prototype', desc: t('stack_prep_desc'), offset: true },
              { img: '/ingredients/meat.webp', name: 'Quotation', desc: t('stack_recipe_desc'), offset: false },
              { img: '/ingredients/lettuce.webp', name: 'Specs', desc: t('stack_validate_desc'), offset: true },
            ].map((item) => (
              <div key={item.name} className={`flex flex-col items-center text-center w-full md:w-40 ${item.offset ? 'md:translate-y-8' : ''}`}>
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-20 h-20 sm:w-36 sm:h-36 object-contain drop-shadow-md mb-5 hover:scale-110 transition-transform duration-500"
                />
                <h4 className="tracking-tight text-black font-bold text-base uppercase">{item.name}</h4>
                <p className="text-xs text-black/50 mt-1 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-[#F9CD25]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p
              className="text-2xl uppercase tracking-tight mb-4 text-white"
              style={{ fontFamily: mousememoirs }}
            >
              {t('pricing_kicker')}
            </p>
            <h2
              className="text-4xl md:text-5xl tracking-tighter mb-6 leading-tight text-white"
              style={{ fontFamily: bowlby }}
            >
              {t('pricing_title_l1')}<br />{t('pricing_title_l2')}
            </h2>
            <p className="text-sm font-semibold leading-relaxed max-w-sm mx-auto text-white">
              {t('pricing_desc')}
            </p>
          </div>

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
                    onClick={() => { trackPostHog('plan_selected', { plan_slug: plan.slug }); router.push(`/register?plan=${plan.slug}`) }}
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
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 md:py-32 bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <p
              className="text-xl md:text-2xl tracking-tight mb-4 uppercase text-[#f91814]"
              style={{ fontFamily: mousememoirs }}
            >
              {t('faq_kicker')}
            </p>
            <h2
              className="text-4xl md:text-6xl tracking-tighter leading-tight text-white"
              style={{ fontFamily: bowlby }}
            >
              {t('faq_title')}
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-zinc-800">
            {FAQS.map((faq, i) => (
              <details key={i} className="group py-6" open={openFaq === i} onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i) }}>
                <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                  <span className="text-base font-semibold text-white tracking-tight">{faq.q}</span>
                  <iconify-icon
                    icon="solar:alt-arrow-down-linear"
                    className={`text-[#f91814] text-xl shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                  ></iconify-icon>
                </summary>
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed font-medium">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-14 text-center">
            <button
              onClick={() => router.push('/register')}
              className="inline-flex items-center gap-2 bg-[#f91814] text-white px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight hover:bg-red-700 transition-colors shadow-md shadow-red-500/20"
            >
              {t('faq_cta')}
              <iconify-icon icon="solar:arrow-right-up-linear" style={{strokeWidth: 1.5}}></iconify-icon>
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-black border-t border-zinc-800 pt-16 pb-10 text-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Top row */}
          <div className="flex flex-col md:flex-row gap-12 md:gap-20 pb-12 border-b border-zinc-800">
            {/* Brand */}
            <div className="flex-1 max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
                  <span className="text-white font-black text-xs" style={{ fontFamily: bowlby }}>S</span>
                </div>
                <span className="text-base font-bold tracking-tight" style={{ fontFamily: bowlby }}>SANDWICH</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                {t('footer_desc')}
              </p>
              <div className="flex items-center gap-3 mt-5">
                {[
                  { icon: 'mdi:instagram', href: 'https://www.instagram.com/etalas.id/', label: 'Instagram' },
                  { icon: 'mdi:linkedin', href: 'https://www.linkedin.com/company/etalas/', label: 'LinkedIn' },
                ].map(({ icon, href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
                    aria-label={label}
                  >
                    <iconify-icon icon={icon} width="15" style={{strokeWidth: 1.5}}></iconify-icon>
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-col sm:flex-row gap-10 flex-1 justify-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">{t('footer_product')}</p>
                <ul className="flex flex-col gap-3">
                  {[
                    { label: t('nav_how'), id: 'harnesses' },
                    { label: t('nav_pipeline'), id: 'pipeline' },
                    { label: t('nav_pricing'), id: 'pricing' },
                    { label: t('nav_faq'), id: 'faq' },
                  ].map(({ label, id }) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }}
                        className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Sandwich</p>
                <ul className="flex flex-col gap-3">
                  {[
                    { label: 'Website', href: 'https://etalas.com' },
                    { label: 'Instagram', href: 'https://www.instagram.com/etalas.id/' },
                    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/etalas/' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a href={href} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-8">
            <p className="text-xs text-zinc-600 font-medium">© 2026 SANDWICH</p>
            <a
              href="https://www.etalas.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <span className="text-sm">{t('footer_product_by')}</span>
              <img src="/logos/etalas-logo.png" alt="Etalas" className="h-4 w-auto brightness-0 invert" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
