'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createConversationLocal } from '../lib/conversations'
import { createMessage } from '../api/conversations'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../lib/i18n'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { FormatMarquee } from './landing/FormatMarquee'
import { Harnesses } from './landing/Harnesses'
import { Pipeline } from './landing/Pipeline'
import { Ingredients } from './landing/Ingredients'
import { SampleOutputsBanner } from './landing/SampleOutputsBanner'
import { Differentiators } from './landing/Differentiators'
import { Pricing } from './landing/Pricing'
import { FinalCta } from './landing/FinalCta'
import { Faq } from './landing/Faq'
import { Footer } from './landing/Footer'
import { FONT_SANS, BG } from './landing/tokens'

const REVEAL_IDS = [
  'harnesses-head', 'pipeline-head', 'about-head', 'samples-head', 'diff-head', 'pricing-head', 'faq-head', 'final-cta-head',
]

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (window.location.hash === '#pricing') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const ids = ['harnesses', 'pipeline', 'differentiators', 'pricing', 'faq']
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
        { rootMargin: '-96px 0px -70% 0px', threshold: 0 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  useEffect(() => {
    const observers = REVEAL_IDS.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setRevealed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach((obs) => obs?.disconnect())
  }, [])

  const reveal = (id: string, extra = '') => `reveal-on-scroll ${revealed.has(id) ? 'is-visible' : ''} ${extra}`

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
      try {
        localStorage.setItem('sandwich_last_chat', JSON.stringify({ prompt: prompt.trim(), conversationId: local.id, autoRun: true }))
      } catch { /* ignore storage errors */ }
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'active subscription required') {
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

  const scrollToSection = (id: string) => {
    activeSectionRef.current = id
    setActiveSectionState(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const ingredientItems = [
    { img: '/ingredients/tomato.webp', name: 'PRD', desc: t('stack_order_desc') },
    { img: '/ingredients/cheese.webp', name: 'Prototype', desc: t('stack_prep_desc') },
    { img: '/ingredients/meat.webp', name: 'Quotation', desc: t('stack_recipe_desc') },
    { img: '/ingredients/lettuce.webp', name: 'Specs', desc: t('stack_validate_desc') },
  ]

  const pipelineSteps = [
    { n: '01', icon: 'solar:clipboard-text-linear', title: t('pipeline_step_1_title'), desc: t('pipeline_step_1_desc') },
    { n: '02', icon: 'solar:widget-2-linear', title: t('pipeline_step_2_title'), desc: t('pipeline_step_2_desc') },
    { n: '03', icon: 'solar:question-circle-linear', title: t('pipeline_step_3_title'), desc: t('pipeline_step_3_desc') },
    { n: '04', icon: 'solar:share-linear', title: t('pipeline_step_4_title'), desc: t('pipeline_step_4_desc') },
  ]

  const differentiatorItems = [
    { icon: 'solar:history-linear', title: t('diff_1_title'), desc: t('diff_1_desc'), highlight: false },
    { icon: 'solar:cloud-check-linear', title: t('diff_2_title'), desc: t('diff_2_desc'), highlight: true },
    { icon: 'solar:link-round-linear', title: t('diff_3_title'), desc: t('diff_3_desc'), highlight: false },
    { icon: 'solar:list-check-linear', title: t('diff_4_title'), desc: t('diff_4_desc'), highlight: false },
  ]

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden antialiased" style={{ fontFamily: FONT_SANS, backgroundColor: BG, color: 'rgba(255,255,255,0.7)' }}>
      <style>{`
        ::selection { background: #3b82f64d; color: #3b82f6; }
        @keyframes sw-reveal { from { opacity: 0; transform: translateY(20px); filter: blur(8px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes sw-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .reveal-on-scroll { animation: sw-reveal 0.8s cubic-bezier(0.2,0.8,0.2,1) both; animation-play-state: paused; }
        .reveal-on-scroll.is-visible { animation-play-state: running; }
        .sw-marquee-track { animation: sw-marquee 32s linear infinite; }
        .sw-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.025] sw-grain" />

      <Nav
        navGetStarted={t('nav_get_started')}
        navLogin={t('nav_login')}
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navDiff={t('nav_diff')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        navMenuOpen={t('nav_menu_open')}
        navMenuClose={t('nav_menu_close')}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'id' : 'en')}
        activeSection={activeSectionState}
        onNavClick={scrollToSection}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        onLogin={() => router.push('/login')}
        onGetStarted={() => router.push('/register')}
      />

      <main>
        <Hero
          heroTagline={t('hero_tagline')}
          navGetStarted={t('nav_get_started')}
          navHow={t('nav_how')}
          heroPromptPlaceholder={t('hero_prompt_placeholder')}
          heroSendLabel={t('hero_send_label')}
          prompt={prompt}
          setPrompt={setPrompt}
          pendingType={pendingType}
          setPendingType={setPendingType}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={() => void handleSubmit()}
          onKeyDown={handleKeyDown}
        />

        <FormatMarquee label={t('nav_pipeline')} />

        <Harnesses
          kicker={t('harnesses_kicker')}
          title={t('harnesses_title')}
          desc={t('harnesses_desc')}
          reveal={reveal}
          rightWriteSpec={t('right_write_spec')}
          rightStructureBrief={t('right_structure_brief')}
          rightQuotation={t('right_quotation')}
        />

        <Pipeline
          kicker={t('pipeline_kicker')}
          titleL1={t('pipeline_title_l1')}
          titleL2={t('pipeline_title_l2')}
          cta={t('pipeline_cta')}
          onCtaClick={() => router.push('/register')}
          reveal={reveal}
          steps={pipelineSteps}
        />

        <Ingredients
          kicker={t('stack_kicker')}
          title={t('stack_title')}
          desc={t('stack_desc')}
          reveal={reveal}
          items={ingredientItems}
        />

        <SampleOutputsBanner
          kicker={t('samples_kicker')}
          titleL1={t('samples_title_l1')}
          titleL2={t('samples_title_l2')}
          desc={t('samples_desc')}
          reveal={reveal}
        />

        <Differentiators
          kicker={t('diff_kicker')}
          title={t('diff_title')}
          reveal={reveal}
          items={differentiatorItems}
        />

        <Pricing
          kicker={t('pricing_kicker')}
          titleL1={t('pricing_title_l1')}
          titleL2={t('pricing_title_l2')}
          desc={t('pricing_desc')}
          bestValue={t('pricing_best_value')}
          reveal={reveal}
          plans={PLANS}
          onSelectPlan={(slug) => { trackPostHog('plan_selected', { plan_slug: slug }); router.push(`/register?plan=${slug}`) }}
        />

        <FinalCta
          title={t('nav_get_started')}
          desc={t('hero_tagline')}
          reveal={reveal}
          prompt={prompt}
          setPrompt={setPrompt}
          pendingType={pendingType}
          setPendingType={setPendingType}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={() => void handleSubmit()}
          onKeyDown={handleKeyDown}
          placeholder={t('hero_prompt_placeholder')}
          sendLabel={t('hero_send_label')}
        />

        <Faq
          kicker={t('faq_kicker')}
          title={t('faq_title')}
          cta={t('faq_cta')}
          onCtaClick={() => router.push('/register')}
          reveal={reveal}
          lang={lang}
          openFaq={openFaq}
          setOpenFaq={setOpenFaq}
        />
      </main>

      <Footer
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        footerDesc={t('footer_desc')}
        footerProduct={t('footer_product')}
        footerLegal={t('footer_legal')}
        footerPrivacy={t('footer_privacy')}
        footerTerms={t('footer_terms')}
        footerRefund={t('footer_refund')}
        footerContact={t('footer_contact')}
        footerProductBy={t('footer_product_by')}
        onNavClick={scrollToSection}
      />
    </div>
  )
}
