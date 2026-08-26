'use client'

import { ACCENT, PANEL_2, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

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

const SIDE_SAMPLES = [
  {
    badge: 'Quotation',
    project: 'Fleet management portal',
    lines: ['Vehicle tracking dashboard — Rp 12.000.000', 'Driver assignment flow — Rp 7.500.000', 'Maintenance scheduling — Rp 6.000.000'],
  },
  {
    badge: 'Specs',
    project: 'Housekeeping ops app',
    lines: ['Room status sync: updates reflect within 5s', 'Offline updates queue and sync on reconnect', 'Only assigned housekeeper can update rooms'],
  },
  {
    badge: 'Prototype',
    project: 'Restaurant table reservation',
    lines: ['19:00 — available', '19:30 — booked', '20:00 — available'],
  },
]

export interface ProofProps {
  kicker: string
  title: string
}

export function Proof(props: ProofProps) {
  return (
    <section id="samples" className="py-24 md:py-32 px-6 max-w-7xl mx-auto border-t scroll-mt-24" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: TEXT_MUTED }}>{props.kicker}</p>
        <h2 className="text-3xl md:text-4xl tracking-tight font-medium" style={{ color: TEXT_PRIMARY }}>{props.title}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Featured PRD sample */}
        <div className="lg:col-span-3 p-8 md:p-10 rounded-3xl border flex flex-col justify-between" style={{ backgroundColor: PANEL_2, borderColor: 'rgba(255,255,255,0.1)' }}>
          <div>
            <span
              className="inline-flex text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-6"
              style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}
            >
              PRD
            </span>
            <h3 className="text-2xl md:text-3xl tracking-tight font-medium leading-snug mb-2" style={{ color: TEXT_PRIMARY }}>{PRD_SAMPLE.heading}</h3>
            <p className="text-sm mb-6" style={{ color: TEXT_MUTED }}>{PRD_SAMPLE.project}</p>
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              {PRD_SAMPLE.rows.map((row, i) => (
                <div key={row.req} className="px-4 py-3.5" style={i !== 0 ? { borderTop: '1px dashed rgba(255,255,255,0.1)' } : undefined}>
                  <p className="text-sm font-medium tracking-tight" style={{ color: TEXT_PRIMARY }}>{row.req}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT_MUTED }}>{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side stack */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {SIDE_SAMPLES.map((sample) => (
            <div key={sample.badge} className="p-6 rounded-3xl border flex flex-col justify-between h-full" style={{ backgroundColor: PANEL_2, borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>{sample.badge}</span>
                <span className="text-xs" style={{ color: TEXT_MUTED }}>{sample.project}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {sample.lines.map((line) => (
                  <p key={line} className="text-xs leading-relaxed" style={{ color: TEXT_PRIMARY, opacity: 0.75 }}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
