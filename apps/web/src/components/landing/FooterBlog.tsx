'use client'
import { Footer } from './Footer'

export function FooterBlog() {
  return (
    <Footer
      navPipeline="Why Spectr"
      navHow="How It Works"
      navDeliverables="Deliverables"
      navComparison="Comparison"
      navPricing="Pricing"
      navFaq="FAQ"
      footerDesc="From a messy brief to a prototype, complete PRD, and a client-ready quotation. One pipeline, not five separate tools."
      footerProductTitle="Product"
      footerContactTitle="Contact"
      footerContact="Contact"
      footerPrivacy="Privacy Policy"
      footerTerms="Terms of Service"
      footerProductBy="powered by"
      footerNote="Email us, we usually reply within 1-2 business days."
      footerRights="All rights reserved."
      onNavClick={(id) => { window.location.href = `/#${id}` }}
    />
  )
}
