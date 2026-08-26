'use client'

import Link from 'next/link'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

export interface FooterProps {
  navPipeline: string
  navHow: string
  navPricing: string
  navFaq: string
  footerDesc: string
  footerProduct: string
  footerLegal: string
  footerPrivacy: string
  footerTerms: string
  footerRefund: string
  footerContact: string
  footerProductBy: string
  onNavClick: (id: string) => void
}

export function Footer(props: FooterProps) {
  return (
    <footer className="border-t border-black/10 pt-16 pb-10" style={{ color: TEXT_PRIMARY }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-12 md:gap-20 pb-12 border-b border-black/10">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="text-base font-medium tracking-tight uppercase">SANDWICH</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{props.footerDesc}</p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { icon: 'mdi:instagram', href: 'https://www.instagram.com/etalas.id/', label: 'Instagram' },
                { icon: 'mdi:linkedin', href: 'https://www.linkedin.com/company/etalas/', label: 'LinkedIn' },
              ].map(({ icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 border border-black/10"
                  style={{ color: TEXT_SECONDARY }}
                  aria-label={label}
                >
                  <iconify-icon icon={icon} width="15" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-10 flex-1 justify-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(10,14,20,0.4)' }}>{props.footerProduct}</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: props.navPipeline, id: 'harnesses' },
                  { label: props.navHow, id: 'pipeline' },
                  { label: props.navPricing, id: 'pricing' },
                  { label: props.navFaq, id: 'faq' },
                ].map(({ label, id }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => { e.preventDefault(); props.onNavClick(id) }}
                      className="text-sm transition-colors font-medium hover:text-blue-400"
                      style={{ color: TEXT_SECONDARY }}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(10,14,20,0.4)' }}>Sandwich</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Website', href: 'https://etalas.com' },
                  { label: 'Instagram', href: 'https://www.instagram.com/etalas.id/' },
                  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/etalas/' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer" className="text-sm transition-colors font-medium hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(10,14,20,0.4)' }}>{props.footerLegal}</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: props.footerPrivacy, href: '/privacy' },
                  { label: props.footerTerms, href: '/terms' },
                  { label: props.footerRefund, href: '/refund' },
                  { label: props.footerContact, href: '/contact' },
                ].map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm transition-colors font-medium hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-8">
          <p className="text-xs" style={{ color: 'rgba(10,14,20,0.4)' }}>© 2026 SANDWICH</p>
          <a href="https://www.etalas.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-blue-400" style={{ color: TEXT_SECONDARY }}>
            <span className="text-sm">{props.footerProductBy}</span>
            <img src="/logos/etalas-logo.png" alt="Etalas" loading="lazy" className="h-4 w-auto" />
          </a>
        </div>
      </div>
    </footer>
  )
}
