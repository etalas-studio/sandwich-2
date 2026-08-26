'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { Hero } from './landing/Hero'
import { IngredientsGrid } from './landing/IngredientsGrid'
import { FormatTicker } from './landing/FormatTicker'
import { Harnesses } from './landing/Harnesses'
import { Pipeline } from './landing/Pipeline'
import { Membership } from './landing/Membership'
import { Proof } from './landing/Proof'
import { Faq } from './landing/Faq'
import { ClosingCta } from './landing/ClosingCta'
import { Footer } from './landing/Footer'
import { FONT_SANS, BG, TEXT_MUTED } from './landing/tokens'

const CONTACT_TITLE = { en: 'Contact', id: 'Kontak' }
const FOOTER_NOTE = {
  en: 'Email us, we usually reply within 1-2 business days.',
  id: 'Kirim email ke kami, biasanya kami balas dalam 1-2 hari kerja.',
}
const FOOTER_RIGHTS = { en: 'All rights reserved.', id: 'Hak cipta dilindungi.' }

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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const goToRegister = () => router.push('/register')

  const ingredientItems = [
    { title: 'PRD', desc: t('stack_order_desc') },
    { title: 'Prototype', desc: t('stack_prep_desc') },
    { title: 'Quotation', desc: t('stack_recipe_desc') },
    { title: 'Specs', desc: t('stack_validate_desc') },
  ]

  const pipelineSteps = [
    { n: '01', icon: 'solar:clipboard-text-linear', title: t('pipeline_step_1_title'), desc: t('pipeline_step_1_desc') },
    { n: '02', icon: 'solar:widget-2-linear', title: t('pipeline_step_2_title'), desc: t('pipeline_step_2_desc') },
    { n: '03', icon: 'solar:question-circle-linear', title: t('pipeline_step_3_title'), desc: t('pipeline_step_3_desc') },
    { n: '04', icon: 'solar:share-linear', title: t('pipeline_step_4_title'), desc: t('pipeline_step_4_desc') },
  ]

  return (
    <div className="min-h-screen antialiased" style={{ fontFamily: FONT_SANS, backgroundColor: BG, color: TEXT_MUTED }}>
      <style>{`::selection { background: rgba(59,130,246,0.3); color: #ffffff; }`}</style>

      <Hero
        heroTagline={t('hero_tagline')}
        heroBenefit={t('nav_how')}
        navPipeline={t('stack_kicker')}
        navHow={t('harnesses_kicker')}
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
        onSecondaryClick={() => scrollToSection('pipeline')}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      <IngredientsGrid
        kicker={t('stack_kicker')}
        title={t('stack_title')}
        desc={t('stack_desc')}
        linkLabel={t('nav_pricing')}
        onLinkClick={() => scrollToSection('pricing')}
        items={ingredientItems}
      />

      <FormatTicker label={t('nav_pipeline')} />

      <Harnesses
        kicker={t('harnesses_kicker')}
        title={t('harnesses_title')}
        desc={t('harnesses_desc')}
        linkLabel={t('nav_how')}
        onLinkClick={() => scrollToSection('pipeline')}
      />

      <Pipeline
        kicker={t('pipeline_kicker')}
        title={`${t('pipeline_title_l1')} ${t('pipeline_title_l2')}`}
        desc={t('diff_title')}
        steps={pipelineSteps}
        ctaLabel={t('pipeline_cta')}
        onCtaClick={goToRegister}
      />

      <Membership
        kicker={t('pricing_kicker')}
        title={`${t('pricing_title_l1')} ${t('pricing_title_l2')}`}
        desc={t('pricing_desc')}
        bestValue={t('pricing_best_value')}
        plans={PLANS}
        onSelectPlan={(slug) => { trackPostHog('plan_selected', { plan_slug: slug }); router.push(`/register?plan=${slug}`) }}
      />

      <Proof kicker={t('samples_kicker')} title={`${t('samples_title_l1')} ${t('samples_title_l2')}`} />

      <Faq
        kicker={t('faq_kicker')}
        title={t('faq_title')}
        lang={lang}
        openFaq={openFaq}
        setOpenFaq={setOpenFaq}
      />

      <ClosingCta
        kicker={t('faq_cta')}
        title={t('diff_title')}
        desc={t('hero_tagline')}
        ctaPrimary={t('nav_get_started')}
        ctaSecondary={t('nav_pricing')}
        onPrimaryClick={goToRegister}
        onSecondaryClick={() => scrollToSection('pricing')}
        bullets={[t('diff_1_title'), t('diff_2_title'), t('diff_3_title')]}
      />

      <Footer
        navPipeline={t('nav_pipeline')}
        navHow={t('nav_how')}
        navPricing={t('nav_pricing')}
        navFaq={t('nav_faq')}
        footerDesc={t('footer_desc')}
        footerProductTitle={t('footer_product')}
        footerContactTitle={CONTACT_TITLE[lang]}
        footerContact={t('footer_contact')}
        footerPrivacy={t('footer_privacy')}
        footerTerms={t('footer_terms')}
        footerProductBy={t('footer_product_by')}
        footerNote={FOOTER_NOTE[lang]}
        footerRights={FOOTER_RIGHTS[lang]}
        onNavClick={scrollToSection}
      />
    </div>
  )
}
