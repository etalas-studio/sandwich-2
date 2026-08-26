'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from './tokens'

const PRD_SAMPLE = {
  project: 'Padel court booking platform',
  heading: 'Business Requirements',
  rows: [
    { req: 'Multi-location support', detail: 'Manage courts across multiple venues from one dashboard' },
    { req: 'Phase 1: third-party booking API', detail: 'Use existing platform for availability + exposure' },
    { req: 'Custom payment UI', detail: 'In-page checkout, no redirect to reduce drop-off' },
    { req: 'Fraud / double-booking prevention', detail: 'Lock slot on payment start, auto-release after 10 min' },
  ],
}

const QUOTATION_SAMPLE = {
  project: 'Fleet management portal',
  heading: 'Scope & Pricing',
  items: [
    { module: 'Vehicle tracking dashboard', days: 8, price: 'Rp 12.000.000' },
    { module: 'Driver assignment flow', days: 5, price: 'Rp 7.500.000' },
    { module: 'Maintenance scheduling', days: 4, price: 'Rp 6.000.000' },
  ],
  assumptions: 'Client provides GPS API access.',
  terms: '50% upfront, 50% on delivery.',
}

const SPECS_SAMPLE = {
  project: 'Housekeeping ops app',
  feature: 'Room status sync',
  scope: 'Housekeeper marks room clean/dirty from mobile; front desk sees live status.',
  criteria: [
    'Status updates reflect in front desk view within 5s',
    'Offline updates queue and sync on reconnect',
    'Only assigned housekeeper can update their rooms',
  ],
}

const PROTOTYPE_SAMPLE = {
  project: 'Restaurant table reservation',
  file: 'dashboard.html',
  slots: [
    { time: '19:00', status: 'available' },
    { time: '19:30', status: 'booked' },
    { time: '20:00', status: 'available' },
  ],
}

function BannerFrame({ badge, project, file, children }: { badge: string; project: string; file: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>{badge}</span>
        <span className="text-xs" style={{ color: TEXT_MUTED }}>{project}</span>
      </div>
      <div className="rounded-lg overflow-hidden border border-white/10" style={{ backgroundColor: PANEL_2 }}>
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          <span className="ml-2 text-[11px] font-mono" style={{ color: TEXT_MUTED }}>{file}</span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function SampleBanners() {
  return (
        <div className="flex flex-col gap-6">
          <BannerFrame badge="PRD" project={PRD_SAMPLE.project} file="prd.md">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>{PRD_SAMPLE.heading}</p>
            <div className="rounded-lg overflow-hidden border border-white/10">
              {PRD_SAMPLE.rows.map((row, i) => (
                <div key={row.req} className={`px-3.5 py-3 ${i !== 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                  <p className="text-xs font-semibold tracking-tight" style={{ color: TEXT_PRIMARY }}>{row.req}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT_MUTED }}>{row.detail}</p>
                </div>
              ))}
            </div>
          </BannerFrame>

          <BannerFrame badge="Quotation" project={QUOTATION_SAMPLE.project} file="quotation.md">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>{QUOTATION_SAMPLE.heading}</p>
            <div className="rounded-lg overflow-hidden border border-white/10">
              {QUOTATION_SAMPLE.items.map((item, i) => (
                <div key={item.module} className={`flex items-center justify-between gap-3 px-3.5 py-3 ${i !== 0 ? 'border-t border-dashed border-white/10' : ''}`}>
                  <div>
                    <p className="text-xs font-semibold tracking-tight" style={{ color: TEXT_PRIMARY }}>{item.module}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>{item.days} days</p>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: ACCENT }}>{item.price}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: TEXT_MUTED }}><span className="font-semibold" style={{ color: TEXT_SECONDARY }}>Assumptions:</span> {QUOTATION_SAMPLE.assumptions}</p>
            <p className="text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}><span className="font-semibold" style={{ color: TEXT_SECONDARY }}>Terms:</span> {QUOTATION_SAMPLE.terms}</p>
          </BannerFrame>

          <BannerFrame badge="Specs" project={SPECS_SAMPLE.project} file="specs.md">
            <p className="text-sm font-semibold tracking-tight mb-1" style={{ color: TEXT_PRIMARY }}>{SPECS_SAMPLE.feature}</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: TEXT_MUTED }}>{SPECS_SAMPLE.scope}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>Acceptance criteria</p>
            <div className="flex flex-col gap-2">
              {SPECS_SAMPLE.criteria.map((c) => (
                <div key={c} className="flex items-start gap-2">
                  <iconify-icon icon="solar:check-circle-bold" width="15" style={{ color: ACCENT, flexShrink: 0, marginTop: '1px' }} />
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>{c}</p>
                </div>
              ))}
            </div>
          </BannerFrame>

          <BannerFrame badge="Prototype" project={PROTOTYPE_SAMPLE.project} file={PROTOTYPE_SAMPLE.file}>
            <div className="flex gap-2">
              {PROTOTYPE_SAMPLE.slots.map((slot) => (
                <div
                  key={slot.time}
                  className="flex-1 text-center rounded-lg py-2.5 text-xs font-semibold tracking-tight"
                  style={slot.status === 'booked' ? { backgroundColor: ACCENT, color: '#ffffff' } : { backgroundColor: 'rgba(255,255,255,0.05)', color: TEXT_PRIMARY }}
                >
                  {slot.time}
                </div>
              ))}
            </div>
          </BannerFrame>
        </div>
  )
}
