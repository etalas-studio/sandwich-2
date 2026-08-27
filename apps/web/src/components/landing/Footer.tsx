'use client'

import Link from 'next/link'
import { GridLines } from './GridLines'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './tokens'

export interface FooterProps {
  navPipeline: string
  navHow: string
  navPricing: string
  navFaq: string
  footerDesc: string
  footerProductTitle: string
  footerContactTitle: string
  footerContact: string
  footerPrivacy: string
  footerTerms: string
  footerProductBy: string
  footerNote: string
  footerRights: string
  onNavClick: (id: string) => void
}

export function Footer(props: FooterProps) {
  return (
    <footer className="overflow-hidden bg-white border-black/5 border-t relative z-20">
      <GridLines />

      <div className="z-10 md:px-8 lg:py-20 max-w-7xl mr-auto ml-auto pt-16 pr-6 pb-16 pl-6 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
              <span className="text-sm font-medium tracking-tight uppercase" style={{ color: LIGHT_TEXT_PRIMARY }}>SANDWICH</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: LIGHT_TEXT_MUTED }}>{props.footerDesc}</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://www.instagram.com/etalas.id/" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-black/5 ring-1 ring-black/10 flex items-center justify-center transition hover:bg-black/10 hover:text-neutral-900" style={{ color: LIGHT_TEXT_MUTED }} aria-label="Instagram">
                <iconify-icon icon="mdi:instagram" width="18" />
              </a>
              <a href="https://www.linkedin.com/company/etalas/" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-black/5 ring-1 ring-black/10 flex items-center justify-center transition hover:bg-black/10 hover:text-neutral-900" style={{ color: LIGHT_TEXT_MUTED }} aria-label="LinkedIn">
                <iconify-icon icon="mdi:linkedin" width="18" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>{props.footerProductTitle}</h3>
            <ul className="mt-4 space-y-3">
              <li><a href="#harnesses" onClick={(e) => { e.preventDefault(); props.onNavClick('harnesses') }} className="text-sm hover:text-neutral-900 transition" style={{ color: LIGHT_TEXT_MUTED }}>{props.navPipeline}</a></li>
              <li><a href="#ingredients" onClick={(e) => { e.preventDefault(); props.onNavClick('ingredients') }} className="text-sm hover:text-neutral-900 transition" style={{ color: LIGHT_TEXT_MUTED }}>{props.navHow}</a></li>
              <li><a href="#pricing" onClick={(e) => { e.preventDefault(); props.onNavClick('pricing') }} className="text-sm hover:text-neutral-900 transition" style={{ color: LIGHT_TEXT_MUTED }}>{props.navPricing}</a></li>
              <li><a href="#faq" onClick={(e) => { e.preventDefault(); props.onNavClick('faq') }} className="text-sm hover:text-neutral-900 transition" style={{ color: LIGHT_TEXT_MUTED }}>{props.navFaq}</a></li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h3 className="text-sm font-medium" style={{ color: LIGHT_TEXT_PRIMARY }}>{props.footerContactTitle}</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="mailto:support@etalas.ai" className="text-sm hover:text-neutral-900 transition inline-flex items-center gap-2" style={{ color: LIGHT_TEXT_MUTED }}>
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-black/5 ring-1 ring-black/10">
                    <iconify-icon icon="solar:letter-linear" width="14" />
                  </span>
                  <span>support@etalas.ai</span>
                </a>
              </li>
              <li>
                <Link href="/contact" className="text-sm hover:text-neutral-900 transition inline-flex items-center gap-2" style={{ color: LIGHT_TEXT_MUTED }}>
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-black/5 ring-1 ring-black/10">
                    <iconify-icon icon="solar:chat-round-linear" width="14" />
                  </span>
                  <span>{props.footerContact}</span>
                </Link>
              </li>
            </ul>
            <p className="mt-6 text-[11px]" style={{ color: 'rgba(10,10,10,0.45)' }}>{props.footerNote}</p>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'rgba(10,10,10,0.45)' }}>
            © {new Date().getFullYear()} SANDWICH <span style={{ color: 'rgba(10,10,10,0.3)' }}>•</span> {props.footerRights}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/privacy" className="text-xs hover:text-neutral-900 transition" style={{ color: 'rgba(10,10,10,0.45)' }}>{props.footerPrivacy}</Link>
            <span style={{ color: 'rgba(10,10,10,0.3)' }}>•</span>
            <Link href="/terms" className="text-xs hover:text-neutral-900 transition" style={{ color: 'rgba(10,10,10,0.45)' }}>{props.footerTerms}</Link>
            <span style={{ color: 'rgba(10,10,10,0.3)' }}>•</span>
            <a href="https://www.etalas.com/" target="_blank" rel="noreferrer" className="text-xs hover:text-neutral-900 transition inline-flex items-center gap-1.5" style={{ color: 'rgba(10,10,10,0.45)' }}>
              {props.footerProductBy}
              <img src="/logos/etalas-logo.png" alt="Etalas" loading="lazy" className="h-3 w-auto opacity-70" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
