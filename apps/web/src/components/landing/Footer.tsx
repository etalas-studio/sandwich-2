'use client'

import Link from 'next/link'
import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface FooterProps {
  navPipeline: string
  navHow: string
  navPricing: string
  navFaq: string
  footerDesc: string
  navGetStarted: string
  footerContact: string
  footerPrivacy: string
  footerTerms: string
  footerProductBy: string
  onNavClick: (id: string) => void
  onGetStartedClick: () => void
}

export function Footer(props: FooterProps) {
  return (
    <footer className="py-12 px-6 max-w-7xl mx-auto border-t text-sm" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full border text-xs tracking-widest uppercase" style={{ borderColor: 'rgba(255,255,255,0.2)', backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
            <span className="text-sm font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>SANDWICH</span>
          </div>
          <p className="max-w-sm leading-relaxed" style={{ color: TEXT_MUTED }}>{props.footerDesc}</p>
        </div>

        <div>
          <p className="font-medium mb-4" style={{ color: TEXT_PRIMARY }}>Navigate</p>
          <div className="flex flex-col gap-3" style={{ color: TEXT_MUTED }}>
            <a href="#harnesses" onClick={(e) => { e.preventDefault(); props.onNavClick('harnesses') }} className="hover:opacity-80 transition-opacity w-fit">{props.navPipeline}</a>
            <a href="#experiences" onClick={(e) => { e.preventDefault(); props.onNavClick('experiences') }} className="hover:opacity-80 transition-opacity w-fit">{props.navHow}</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); props.onNavClick('pricing') }} className="hover:opacity-80 transition-opacity w-fit">{props.navPricing}</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); props.onNavClick('faq') }} className="hover:opacity-80 transition-opacity w-fit">{props.navFaq}</a>
          </div>
        </div>

        <div>
          <p className="font-medium mb-4" style={{ color: TEXT_PRIMARY }}>Connect</p>
          <div className="flex flex-col gap-3" style={{ color: TEXT_MUTED }}>
            <button onClick={props.onGetStartedClick} className="hover:opacity-80 transition-opacity w-fit text-left">{props.navGetStarted}</button>
            <Link href="/contact" className="hover:opacity-80 transition-opacity w-fit">{props.footerContact}</Link>
            <a href="https://www.instagram.com/etalas.id/" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity w-fit">Instagram</a>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ borderColor: 'rgba(255,255,255,0.1)', color: TEXT_MUTED }}>
        <p>© 2026 SANDWICH.</p>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="hover:opacity-80 transition-opacity">{props.footerPrivacy}</Link>
          <Link href="/terms" className="hover:opacity-80 transition-opacity">{props.footerTerms}</Link>
          <a
            href="https://www.etalas.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span>{props.footerProductBy}</span>
            <img src="/logos/etalas-logo.png" alt="Etalas" loading="lazy" className="h-3.5 w-auto brightness-0 invert" />
          </a>
        </div>
      </div>
    </footer>
  )
}
