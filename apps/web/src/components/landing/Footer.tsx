'use client'

import Link from 'next/link'
import { ACCENT } from './tokens'

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
  const white = 'rgba(255,255,255,1)'

  return (
    <footer className="overflow-hidden border-white/20 border-t relative z-20">
      {/* Background: image, fade to white at top, solid blue at bottom — no dark overlay */}
      <div className="absolute inset-0 -z-10">
        <img src="/footer-bg-final.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110" />
        {/* Top: fade to white so it blends with the section above */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 35%)' }} />
        {/* Bottom: solid blue fill — same hue as the image, no black */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(80,115,150,1) 0%, rgba(80,115,150,0.5) 40%, rgba(80,115,150,0) 65%)' }} />
      </div>

      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pt-64 pr-6 pb-16 pl-6 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold" style={{ backgroundColor: ACCENT, color: '#ffffff' }}>S</span>
              <span className="text-base font-medium tracking-tight uppercase" style={{ color: white }}>SANDWICH</span>
            </div>
            <p className="mt-4 text-base leading-relaxed max-w-xs" style={{ color: white }}>{props.footerDesc}</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://www.instagram.com/etalas.id/" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/15 ring-1 ring-white/30 flex items-center justify-center transition hover:bg-white/25" style={{ color: white }} aria-label="Instagram">
                <iconify-icon icon="mdi:instagram" width="18" />
              </a>
              <a href="https://www.linkedin.com/company/etalas/" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/15 ring-1 ring-white/30 flex items-center justify-center transition hover:bg-white/25" style={{ color: white }} aria-label="LinkedIn">
                <iconify-icon icon="mdi:linkedin" width="18" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium" style={{ color: white }}>{props.footerProductTitle}</h3>
            <ul className="mt-4 space-y-3">
              <li><a href="#why" onClick={(e) => { e.preventDefault(); props.onNavClick('why') }} className="text-base hover:text-white transition" style={{ color: white }}>{props.navPipeline}</a></li>
              <li><a href="#deliverables" onClick={(e) => { e.preventDefault(); props.onNavClick('deliverables') }} className="text-base hover:text-white transition" style={{ color: white }}>{props.navHow}</a></li>
              <li><a href="#pricing" onClick={(e) => { e.preventDefault(); props.onNavClick('pricing') }} className="text-base hover:text-white transition" style={{ color: white }}>{props.navPricing}</a></li>
              <li><a href="#faq" onClick={(e) => { e.preventDefault(); props.onNavClick('faq') }} className="text-base hover:text-white transition" style={{ color: white }}>{props.navFaq}</a></li>
              <li><Link href="/blog" className="text-base hover:text-white transition" style={{ color: white }}>Blog</Link></li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h3 className="text-base font-medium" style={{ color: white }}>{props.footerContactTitle}</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="mailto:support@etalas.ai" className="text-base hover:text-white transition inline-flex items-center gap-2" style={{ color: white }}>
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                    <iconify-icon icon="solar:letter-linear" width="14" />
                  </span>
                  <span>support@etalas.ai</span>
                </a>
              </li>
              <li>
                <Link href="/contact" className="text-base hover:text-white transition inline-flex items-center gap-2" style={{ color: white }}>
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                    <iconify-icon icon="solar:chat-round-linear" width="14" />
                  </span>
                  <span>{props.footerContact}</span>
                </Link>
              </li>
            </ul>
            <p className="mt-6 text-sm" style={{ color: white, opacity: 0.85 }}>{props.footerNote}</p>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-sm" style={{ color: white, opacity: 0.85 }}>
            © {new Date().getFullYear()} SANDWICH <span style={{ color: 'rgba(255,255,255,0.7)' }}>•</span> {props.footerRights}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/privacy" className="text-sm hover:text-white transition" style={{ color: white, opacity: 0.85 }}>{props.footerPrivacy}</Link>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>•</span>
            <Link href="/terms" className="text-sm hover:text-white transition" style={{ color: white, opacity: 0.85 }}>{props.footerTerms}</Link>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>•</span>
            <a href="https://www.etalas.com/" target="_blank" rel="noreferrer" className="text-sm hover:text-white transition inline-flex items-center gap-1.5" style={{ color: white, opacity: 0.85 }}>
              {props.footerProductBy}
              <img src="/logos/etalas-logo.png" alt="Etalas" loading="lazy" className="h-3 w-auto opacity-90 transition-opacity" style={{ filter: 'brightness(0) invert(1)' }} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
