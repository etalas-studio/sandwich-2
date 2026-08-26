'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { HeroCard } from './landing/HeroCard'
import { Methodology } from './landing/Methodology'
import { Experiences } from './landing/Experiences'
import { Studio } from './landing/Studio'
import { Membership } from './landing/Membership'
import { Proof } from './landing/Proof'
import { FaqCta } from './landing/FaqCta'
import { Footer } from './landing/Footer'
import { FONT_SANS, BG, TEXT_MUTED } from './landing/tokens'

export default function LandingPage() {
  const { lang, setLang, t } = useLanguage()
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

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.location.hash === '#pricing') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)
    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    setRevealed(true)
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const goToRegister = () => router.push('/register')

  const ingredientMeta = [
    { key: 'PRD', icon: 'solar:document-text-linear', img: '/ingredients/tomato.webp' },
    { key: 'Prototype', icon: 'solar:widget-2-linear', img: '/ingredients/cheese.webp' },
    { key: 'Quotation', icon: 'solar:money-bag-linear', img: '/ingredients/meat.webp' },
    { key: 'Specs', icon: 'solar:list-check-linear', img: '/ingredients/lettuce.webp' },
  ]
  const ingredientDescs = [t('stack_order_desc'), t('stack_prep_desc'), t('stack_recipe_desc'), t('stack_validate_desc')]
  const experienceItems = ingredientMeta.map((meta, i) => ({
    n: `0${i + 1}`,
    icon: meta.icon,
    img: meta.img,
    title: meta.key,
    fullTitle: meta.key,
    desc: ingredientDescs[i],
    tags: ingredientDescs[i].split('&').map((s) => s.trim()).filter(Boolean),
  }))

  const methodologyCards = [
    { n: '01', title: t('pipeline_step_1_title') },
    { n: '02', title: t('pipeline_step_2_title') },
  ]

  const studioCards = [
    { n: '01', title: t('diff_1_title'), desc: t('diff_1_desc') },
    { n: '02', title: t('diff_2_title'), desc: t('diff_2_desc') },
  ]
  const studioNumbered = [
    { n: '01', text: t('diff_3_desc') },
    { n: '02', text: t('diff_4_desc') },
  ]

  const includedLabel = lang === 'id' ? 'Yang Termasuk' : 'Included Access'
  const ctaKicker = lang === 'id' ? 'Langkah Selanjutnya' : 'Next Step'

  return (
    <div ref={rootRef} className="min-h-screen antialiased" style={{ fontFamily: FONT_SANS, backgroundColor: BG, color: TEXT_MUTED }}>
      <style>{`
        ::selection { background: rgba(255,255,255,0.2); color: #ffffff; }
        .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
        .reveal.is-revealed { opacity: 1; transform: translateY(0); }
      `}</style>

      <HeroCard
        heroTagline={t('hero_tagline')}
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navDiff={t('nav_diff')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        navGetStarted={t('nav_get_started')}
        navLogin={t('nav_login')}
        navMenuOpen={t('nav_menu_open')}
        navMenuClose={t('nav_menu_close')}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'id' : 'en')}
        onNavClick={scrollToSection}
        onGetStartedClick={goToRegister}
        onLoginClick={() => router.push('/login')}
        onScrollDownClick={() => scrollToSection('harnesses')}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      <Methodology
        kicker={t('harnesses_kicker')}
        title={t('harnesses_title')}
        desc={t('harnesses_desc')}
        bodyText={t('stack_desc')}
        ctaLabel={t('nav_how')}
        onCtaClick={() => scrollToSection('experiences')}
        cards={methodologyCards}
      />

      <Experiences
        kicker={t('stack_kicker')}
        title={t('stack_title')}
        desc={t('stack_desc')}
        items={experienceItems}
      />

      <Studio
        kicker={t('diff_kicker')}
        title={t('diff_title')}
        body={t('footer_desc')}
        badge={t('pipeline_kicker')}
        cards={studioCards}
        numbered={studioNumbered}
      />

      <Membership
        kicker={t('pricing_kicker')}
        titleL1={t('pricing_title_l1')}
        titleL2={t('pricing_title_l2')}
        desc={t('pricing_desc')}
        bestValue={t('pricing_best_value')}
        includedLabel={includedLabel}
        plans={PLANS}
        onSelectPlan={(slug) => { trackPostHog('plan_selected', { plan_slug: slug }); router.push(`/register?plan=${slug}`) }}
      />

      <Proof
        kicker={t('samples_kicker')}
        title={`${t('samples_title_l1')} ${t('samples_title_l2')}`}
      />

      <FaqCta
        title={t('faq_title')}
        desc={t('hero_tagline')}
        lang={lang}
        openFaq={openFaq}
        setOpenFaq={setOpenFaq}
        ctaKicker={ctaKicker}
        ctaTitle={t('nav_get_started')}
        ctaDesc={t('footer_desc')}
        ctaPrimary={t('nav_get_started')}
        ctaSecondary={t('nav_pricing')}
        onCtaPrimaryClick={goToRegister}
        onCtaSecondaryClick={() => scrollToSection('pricing')}
      />

      <Footer
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        footerDesc={t('footer_desc')}
        navGetStarted={t('nav_get_started')}
        footerContact={t('footer_contact')}
        footerPrivacy={t('footer_privacy')}
        footerTerms={t('footer_terms')}
        footerProductBy={t('footer_product_by')}
        onNavClick={scrollToSection}
        onGetStartedClick={goToRegister}
      />
    </div>
  )
}
