'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../lib/i18n'
import { useAuth } from '../hooks/useAuth'
import { PLANS_META } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'
import { Hero } from './landing/Hero'
import { LogoCloud } from './landing/LogoCloud'
import { Deliverables } from './landing/Deliverables'
import { Pipeline } from './landing/Pipeline'
import { Membership } from './landing/Membership'
import { Comparison } from './landing/Comparison'
import { Why } from './landing/Why'
import { Faq } from './landing/Faq'
import { ClosingCta } from './landing/ClosingCta'
import { Footer } from './landing/Footer'
import { LoginModal } from './LoginModal'
import { RegisterModal } from './RegisterModal'
import { FONT_SANS, LIGHT_BG, LIGHT_TEXT_MUTED } from './landing/tokens'

const CONTACT_TITLE = { en: 'Contact', id: 'Kontak' }
const FOOTER_NOTE = {
  en: 'Email us, we usually reply within 1-2 business days.',
  id: 'Kirim email ke kami, biasanya kami balas dalam 1-2 hari kerja.',
}
const FOOTER_RIGHTS = { en: 'All rights reserved.', id: 'Hak cipta dilindungi.' }

const HERO_SUGGESTIONS = (lang: 'en' | 'id') => [
  { label: 'PRD', prompt: lang === 'id' ? 'Buatkan PRD lengkap untuk project ini' : 'Create a complete PRD for this project' },
  { label: 'Prototype', prompt: lang === 'id' ? 'Buatkan prototype brief untuk project ini' : 'Create a prototype brief for this project' },
  { label: 'Quotation', prompt: lang === 'id' ? 'Buatkan quotation untuk project ini' : 'Create a quotation for this project' },
  { label: 'Specs', prompt: lang === 'id' ? 'Buatkan specs dan task breakdown untuk fitur ini' : 'Create specs and a task breakdown for this feature' },
]

export default function LandingPage({ initialLoginOpen = false, initialRegisterOpen = false }: { initialLoginOpen?: boolean; initialRegisterOpen?: boolean } = {}) {
  const { lang, setLang, t } = useLanguage()
  const { state: authState } = useAuth()
  const router = useRouter()

  // Split the hero tagline: the leading text uses Inter Tight (sans),
  // the last few words stay in Instrument Serif italic (screenbolt-style mix).
  const heroTagline = t('hero_tagline')
  // The serif tail covers the final short phrase (last few words).
  const serifMarker = lang === 'id' ? 'Satu pipeline terpandu.' : 'One guided pipeline.'
  const serifIdx = heroTagline.lastIndexOf(serifMarker)
  const heroTaglineSans = serifIdx >= 0 ? heroTagline.slice(0, serifIdx).trimEnd() : heroTagline
  const heroTaglineSerif = serifIdx >= 0 ? heroTagline.slice(serifIdx) : ''
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(initialLoginOpen)
  const openLogin = () => { setLoginModalOpen(true); router.push('/login') }
  const closeLogin = () => { setLoginModalOpen(false); router.push('/') }
  const [registerModalOpen, setRegisterModalOpen] = useState(initialRegisterOpen)

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const openRegister = () => { setRegisterModalOpen(true); router.push('/register') }
  const closeRegister = () => { setRegisterModalOpen(false); router.push('/') }
  const goToRegister = openRegister

  // Persist the typed brief so it survives the redirect (the dashboard
  // PromptBox reads `spectr_draft` on mount), then route the user either
  // into the dashboard (already logged in) or registration (anonymous).
  const handlePromptSubmit = (prompt: string, attachments: { name: string; type: string; dataUrl: string }[]) => {
    try {
      localStorage.setItem('spectr_draft', JSON.stringify({ prompt, attachments, activeType: null }))
    } catch { /* ignore storage failures */ }
    trackPostHog('landing_prompt_submitted')
    const isAuthed = authState.status === 'authenticated'
    if (isAuthed) { router.push('/dashboard') } else { openRegister() }
  }

  const pipelineSteps = [
    { n: '01', icon: 'solar:clipboard-text-linear', title: t('pipeline_step_1_title'), desc: t('pipeline_step_1_desc'), image: '/pipeline-1.webp' },
    { n: '02', icon: 'solar:widget-2-linear', title: t('pipeline_step_2_title'), desc: t('pipeline_step_2_desc'), image: '/pipeline-2.webp' },
    { n: '03', icon: 'solar:question-circle-linear', title: t('pipeline_step_3_title'), desc: t('pipeline_step_3_desc'), image: '/pipeline-3.webp' },
    { n: '04', icon: 'solar:share-linear', title: t('pipeline_step_4_title'), desc: t('pipeline_step_4_desc'), image: '/pipeline-4.webp' },
  ]

  return (
    <div className="sb-landing min-h-screen antialiased" style={{ fontFamily: FONT_SANS, backgroundColor: LIGHT_BG, color: LIGHT_TEXT_MUTED }}>
      <style>{`::selection { background: rgba(59,130,246,0.3); color: #ffffff; }`}</style>

      <Hero
        heroTagline={heroTaglineSerif}
        heroTaglineSans={heroTaglineSans}
        heroBenefit={t('nav_how')}
        navHow={t('nav_how')}
        navDiff={t('nav_diff')}
        navDeliverables={t('nav_deliverables')}
        navComparison={t('nav_comparison')}
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
        onLoginClick={() => openLogin()}
        onSecondaryClick={() => scrollToSection('pipeline')}
        onPromptSubmit={handlePromptSubmit}
        heroPromptPlaceholder={t('hero_prompt_placeholder')}
        heroSendLabel={t('hero_send_label')}
        suggestions={HERO_SUGGESTIONS(lang)}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      {/* <LogoCloud label={t('trusted_by')} /> */}

      <Why
        kicker={t('diff_kicker')}
        titleSans={t('diff_title_sans')}
        titleSerif={t('diff_title_serif')}
        items={[
          { title: t('diff_1_title'), desc: t('diff_1_desc') },
          { title: t('diff_2_title'), desc: t('diff_2_desc') },
          { title: t('diff_3_title'), desc: t('diff_3_desc') },
          { title: t('diff_4_title'), desc: t('diff_4_desc') },
        ]}
      />

      <Pipeline
        kicker={t('pipeline_kicker')}
        titleLine1={t('pipeline_title_l1')}
        titleLine2={t('pipeline_title_l2')}
        desc={t('pipeline_subtitle')}
        steps={pipelineSteps}
      />

      <Deliverables
        kicker={t('deliverables_kicker')}
        titleSans={t('deliverables_title_sans')}
        titleSerif={t('deliverables_title_serif')}
        desc={t('deliverables_desc')}
        colName={t('deliverables_col_name')}
        colDesc={t('deliverables_col_desc')}
        rows={[
          { name: t('deliverables_prd'), desc: t('deliverables_prd_desc') },
          { name: t('deliverables_proto'), desc: t('deliverables_proto_desc') },
          { name: t('deliverables_quotation'), desc: t('deliverables_quotation_desc') },
          { name: t('deliverables_specs'), desc: t('deliverables_specs_desc') },
        ]}
      />

      <Comparison
        kicker={t('comparison_kicker')}
        titleSans={t('comparison_title_sans')}
        titleSerif={t('comparison_title_serif')}
        desc={t('comparison_desc')}
        colAspect={t('comparison_col_aspect')}
        colSandwich={t('comparison_col_sandwich')}
        colManual={t('comparison_col_manual')}
        rows={[
          { aspect: t('comparison_row_pd'), sandwich: t('comparison_row_pd_s'), manual: t('comparison_row_pd_m') },
          { aspect: t('comparison_row_quote'), sandwich: t('comparison_row_quote_s'), manual: t('comparison_row_quote_m') },
          { aspect: t('comparison_row_proto'), sandwich: t('comparison_row_proto_s'), manual: t('comparison_row_proto_m') },
          { aspect: t('comparison_row_version'), sandwich: t('comparison_row_version_s'), manual: t('comparison_row_version_m') },
          { aspect: t('comparison_row_share'), sandwich: t('comparison_row_share_s'), manual: t('comparison_row_share_m') },
          { aspect: t('comparison_row_quality'), sandwich: t('comparison_row_quality_s'), manual: t('comparison_row_quality_m') },
        ]}
      />

      <Membership
        kicker={t('pricing_kicker')}
        titleSans={t('pricing_title_l1')}
        titleSerif={t('pricing_title_l2')}
        desc={t('pricing_desc')}
        bestValue={t('pricing_best_value')}
        plans={PLANS}
        onSelectPlan={(slug) => { trackPostHog('plan_selected', { plan_slug: slug }); router.push(`/register?plan=${slug}`) }}
      />

      <Faq
        kicker={t('faq_kicker')}
        titleSans={t('faq_title_sans')}
        titleSerif={t('faq_title_serif')}
        lang={lang}
      />

      <ClosingCta
        kicker={t('faq_cta')}
        titleSans={t('diff_title_sans')}
        titleSerif={t('diff_title_serif')}
        desc={t('hero_tagline')}
        ctaPrimary={t('closing_cta')}
        onPrimaryClick={goToRegister}
      />

      <Footer
        navPipeline={t('nav_diff')}
        navHow={t('nav_how')}
        navDeliverables={t('nav_deliverables')}
        navComparison={t('nav_comparison')}
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
      {loginModalOpen && (
        <LoginModal
          onClose={() => closeLogin()}
          onSwitchToRegister={() => { closeLogin(); openRegister() }}
        />
      )}
      {registerModalOpen && (
        <RegisterModal
          onClose={() => closeRegister()}
          onSwitchToLogin={() => { closeRegister(); openLogin() }}
        />
      )}
    </div>
  )
}
