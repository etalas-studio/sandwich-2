'use client'

import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED, LIGHT_TEXT_SECONDARY, FONT_SANS, FONT_SERIF } from './tokens'

export interface WhyProps {
  kicker: string
  titleSans: string
  titleSerif: string
  items: { title: string; desc: string }[]
}

const FOLDER_VERSIONS = [
  { label: 'PRD', count: 'v1 → v3', from: '#6366f1', to: '#818cf8' },
  { label: 'Prototype', count: 'v1 → v2', from: '#06b6d4', to: '#22d3ee' },
  { label: 'Quotation', count: 'v1 → v4', from: '#ec4899', to: '#f472b6' },
  { label: 'Specs', count: 'v1 → v2', from: '#8b5cf6', to: '#a78bfa' },
]

function FolderIcon({ from, to, label, count }: { from: string; to: string; label: string; count: string }) {
  return (
    <div className="relative w-full" style={{ paddingTop: '72%' }}>
      <div className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${from}cc, ${to}cc)`, transform: 'translate(6px, -6px) scale(0.97)', borderRadius: '1rem' }} />
      <div className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${from}dd, ${to}dd)`, transform: 'translate(3px, -3px) scale(0.985)', borderRadius: '1rem' }} />
      <div className="absolute inset-0 rounded-2xl flex flex-col justify-end p-4" style={{ background: `linear-gradient(135deg, ${from}, ${to})`, borderRadius: '1rem' }}>
        <div className="absolute top-0 left-4 w-12 h-3 rounded-t-lg" style={{ background: `${from}88` }} />
        <p className="text-white font-semibold text-sm leading-tight">{label}</p>
        <p className="text-white/70 text-xs mt-0.5">{count}</p>
      </div>
    </div>
  )
}

function VersionStack() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FOLDER_VERSIONS.map((f) => <FolderIcon key={f.label} {...f} />)}
    </div>
  )
}

const PERSISTED_DOCS = [
  { name: 'PRD — Padel Booking', time: '2 days ago', icon: 'solar:file-text-linear' },
  { name: 'Quotation — Fleet Portal', time: 'last week', icon: 'solar:wallet-linear' },
  { name: 'Specs — Housekeeping', time: 'last month', icon: 'solar:list-check-linear' },
]

function PersistedDocs() {
  return (
    <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Your documents</span>
        <iconify-icon icon="solar:folder-2-linear" width="15" className="text-slate-400" />
      </div>
      {PERSISTED_DOCS.map((d) => (
        <div key={d.name} className="px-4 py-2.5 flex items-center gap-3 border-b border-black/5 last:border-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <iconify-icon icon={d.icon} width="14" style={{ color: ACCENT }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-800 truncate">{d.name}</p>
            <p className="text-[10px] text-slate-400">{d.time}</p>
          </div>
          <iconify-icon icon="solar:check-circle-linear" width="14" className="shrink-0" style={{ color: '#10b981' }} />
        </div>
      ))}
    </div>
  )
}

function ShareLink() {
  return (
    <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-black/5">
        <iconify-icon icon="solar:link-linear" width="14" style={{ color: ACCENT }} />
        <span className="text-xs font-semibold text-slate-700">Shareable link</span>
      </div>
      <div className="p-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400 truncate flex items-center gap-1.5">
          <iconify-icon icon="solar:lock-keyhole-linear" width="12" className="shrink-0" />
          sandwich.app/read-only/abc123
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">View only — no account needed</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2.5 py-1" style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}>
            <iconify-icon icon="solar:copy-linear" width="11" />
            Copy
          </span>
        </div>
      </div>
    </div>
  )
}

function DeliverableProgress() {
  const steps = [
    { label: 'PRD', done: true },
    { label: 'Quotation', done: true },
    { label: 'Prototype', done: false, active: true },
    { label: 'Specs', done: false },
  ]
  return (
    <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-700">One deliverable at a time</span>
        <span className="text-[10px] font-medium text-slate-400">2/4</span>
      </div>
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold" style={{ backgroundColor: s.done ? '#10b981' : s.active ? `${ACCENT}26` : '#f1f5f9', color: s.done ? '#ffffff' : s.active ? ACCENT : '#94a3b8', boxShadow: s.active ? `0 0 0 3px ${ACCENT}33` : undefined }}>
              {s.done ? <iconify-icon icon="solar:check-bold" width="12" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-4 h-0.5 rounded" style={{ backgroundColor: s.done ? '#10b981' : '#e2e8f0' }} />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: ACCENT }}>Generating prototype…</span>
      </div>
    </div>
  )
}

export function Why(props: WhyProps) {
  const [one, two, three, four] = props.items
  return (
    <section id="why" className="overflow-hidden lg:py-24 pt-16 pb-16 relative z-20 scroll-mt-24" style={{ backgroundColor: '#ffffff' }}>
      <div className="z-10 md:px-8 max-w-7xl mr-auto ml-auto pr-6 pl-6 relative">
        <div className="max-w-3xl">
          <div className="inline-flex text-[11px] ring-1 ring-black/10 font-medium bg-black/5 rounded-full pt-1.5 pr-3 pb-1.5 pl-3 gap-x-2 gap-y-2 items-center" style={{ color: LIGHT_TEXT_MUTED }}>
            <iconify-icon icon="solar:star-linear" width="14" />
            <iconify-icon icon="solar:star-shine-linear" width="13" /><span>{props.kicker}</span>
          </div>
          <h2 className="mt-4 sm:text-5xl md:text-6xl text-4xl font-normal tracking-tighter" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>
            {props.titleSans}{' '}
            <span className="italic" style={{ fontFamily: FONT_SERIF }}>{props.titleSerif}</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:row-span-2 rounded-3xl bg-neutral-50 p-8 ring-1 ring-black/5 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>{one.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: LIGHT_TEXT_SECONDARY }}>{one.desc}</p>
            </div>
            <div className="mt-8"><VersionStack /></div>
          </div>

          <div className="rounded-3xl bg-neutral-50 p-8 ring-1 ring-black/5 flex flex-col justify-between shadow-sm">
            <h3 className="text-2xl font-semibold tracking-tight" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>{two.title}</h3>
            <div className="mt-6 flex justify-center"><PersistedDocs /></div>
            <p className="mt-6 text-sm leading-relaxed" style={{ color: LIGHT_TEXT_SECONDARY }}>{two.desc}</p>
          </div>

          <div className="rounded-3xl bg-neutral-50 p-8 ring-1 ring-black/5 flex flex-col justify-between shadow-sm">
            <div className="flex justify-center"><ShareLink /></div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-center" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>{three.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-center" style={{ color: LIGHT_TEXT_SECONDARY }}>{three.desc}</p>
          </div>

          <div className="md:col-span-2 rounded-3xl bg-neutral-50 p-6 ring-1 ring-black/5 flex items-center justify-between gap-8 shadow-sm">
            <div className="max-w-md">
              <h3 className="text-2xl font-semibold tracking-tight" style={{ color: LIGHT_TEXT_PRIMARY, fontFamily: FONT_SANS }}>{four.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: LIGHT_TEXT_SECONDARY }}>{four.desc}</p>
            </div>
            <div className="flex-1 hidden sm:block"><DeliverableProgress /></div>
          </div>
        </div>
      </div>
    </section>
  )
}
