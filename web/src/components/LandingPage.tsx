import { useState, useRef, useCallback } from 'react'
import { createTicket } from '../api/tickets'
import { saveTicket } from '../lib/localTickets'

interface LandingPageProps {
  onGoToApp: () => void
}

const bowlby = "'Bowlby One', system-ui"
const mousememoirs = "'Mouse Memoirs', sans-serif"

const FAQS = [
  {
    q: 'Who built this?',
    a: 'SANDWICH was built at Etalas, an Indonesian software house working with enterprise clients. These skills were forged from actual agency battles — messy inputs, unpredictable AI, and the need for reliable delivery.',
  },
  {
    q: 'Why does this exist?',
    a: "Client briefs are chaotic by nature. SANDWICH gives you a repeatable pipeline — from raw client input to validated, machine-checkable specs — so your AI agent doesn't guess, it executes.",
  },
  {
    q: 'Is it free?',
    a: 'Starter is free forever. Pro and Team unlock priority processing, longer specs, team seats, and API access.',
  },
  {
    q: 'Which AI agents are supported?',
    a: 'Pi, Claude Code, and Codex out of the box. More agents coming as the ecosystem grows.',
  },
  {
    q: 'Do I need to configure anything?',
    a: "Just install via your agent's skill manager. The Order → Prep → Recipe pipeline works out of the box.",
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: 'Rp 50k',
    priceNote: '/ bulan',
    desc: 'Buat yang mulai serius.',
    features: [
      'Premium AI model',
      '5 PRD / bulan',
      'Chat dengan AI mengenai planning PRD, fitur, task (100x/bln)',
      'Download Markdown',
      'Generate specs untuk fitur dan task',
    ],
    cta: 'Mulai Sekarang',
    highlight: false,
    oldPrice: null as string | null,
  },
  {
    name: 'Pro',
    price: 'Rp 100k',
    priceNote: '/ bulan',
    oldPrice: 'Rp 250k',
    desc: 'Unlimited, semua akses.',
    features: [
      'Premium AI model',
      'Unlimited PRD',
      'Chat dengan AI mengenai planning PRD, fitur, task (unlimited)',
      'Download Markdown',
      'Chat langsung dengan Raf Dev untuk bantuan',
      'Generate specs untuk fitur dan task',
    ],
    cta: 'Upgrade ke Pro',
    highlight: true,
  },
]

interface AttachedFile {
  name: string
  type: string
  dataUrl: string
}

export default function LandingPage({ onGoToApp }: LandingPageProps) {
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [...prev, { name: file.name, type: file.type, dataUrl: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [])

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const desc = attachments.length
        ? attachments.map((a) => `[attachment: ${a.name}]`).join('\n')
        : ''
      const ticket = await createTicket({ id: '', summary: prompt.trim(), description: desc, url: '' })
      saveTicket({ id: ticket.key, summary: ticket.summary ?? prompt.trim(), description: desc, createdAt: ticket.createdAt, type: 'general', status: 'processing' })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim')
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden selection:bg-[#f91814] selection:text-white text-zinc-800 antialiased"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}
    >
      {/* ── NAV ── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="flex items-center gap-1 px-3 py-2 rounded-full border"
          style={{
            backgroundColor: '#F4EBE1',
            borderColor: 'rgba(0,0,0,0.1)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-1" style={{ backgroundColor: '#f91814' }}>
            <span className="text-white font-black text-[10px]" style={{ fontFamily: bowlby }}>S</span>
          </div>
          {[
            { id: 'harnesses', label: 'How It Works' },
            { id: 'pipeline', label: 'Pipeline' },
            { id: 'faq', label: 'FAQ' },
            { id: 'pricing', label: 'Pricing' },
          ].map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors hover:text-black"
              style={{ color: '#6b7280' }}
            >
              {label}
            </a>
          ))}
          <button
            onClick={onGoToApp}
            className="ml-1 px-4 py-1.5 rounded-full text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
          >
            Get Started
          </button>
        </nav>
      </div>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 flex flex-col items-center text-center px-6 overflow-hidden">
        {/* watermark */}
        <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-5 pointer-events-none select-none">
          <span className="text-[25vw] leading-none text-[#F4A804]" style={{ fontFamily: bowlby }}>
            SANDWICH
          </span>
        </div>

        <h1
          className="text-5xl md:text-7xl leading-none text-[#f91814] tracking-tighter max-w-5xl mx-auto drop-shadow-sm"
          style={{ fontFamily: bowlby }}
        >
          SANDWICH
        </h1>

        <p
          className="text-2xl md:text-4xl tracking-tight mt-6 text-[#F4A804]"
          style={{ fontFamily: mousememoirs }}
        >
          Dari brief berantakan jadi spek siap eksekusi
        </p>

        {/* prompt box */}
        <div className="w-full max-w-xl mx-auto mt-12 z-10">
          {submitted ? (
            <div className="rounded-2xl p-8 text-center border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f91814' }}>
                <iconify-icon icon="solar:check-circle-bold" width="24" style={{ color: '#ffffff' }} />
              </div>
              <p className="font-semibold text-zinc-900 mb-1">Ticket dibuat!</p>
              <p className="text-sm text-zinc-400 mb-5">Pipeline sedang memproses brief kamu. Cek hasilnya di dashboard.</p>
              <button
                onClick={onGoToApp}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white mx-auto hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#f91814' }}
              >
                Lihat hasil
                <iconify-icon icon="solar:arrow-right-linear" width="14" />
              </button>
            </div>
          ) : (
            <>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />

              <div
                className="relative bg-black rounded-xl overflow-hidden shadow-lg"
              >
                {/* chips */}
                <div className="flex flex-wrap gap-2 px-5 pt-5 pb-2">
                  {[
                    { label: 'PRD', prompt: 'Buatkan PRD lengkap untuk fitur ' },
                    { label: 'MOM', prompt: 'Buatkan notulen rapat dari transcript berikut: ' },
                    { label: 'Quotation', prompt: 'Buatkan quotation untuk project ' },
                    { label: 'Prototype', prompt: 'Buatkan prototype brief untuk ' },
                    { label: 'Specs', prompt: 'Breakdown specs dan task untuk fitur ' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => setPrompt(chip.prompt)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-70"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ceritain project atau brief kamu di sini…"
                  rows={4}
                  className="w-full resize-none bg-transparent text-white text-sm outline-none px-5 pt-3 pb-2 leading-relaxed placeholder:text-white/30"
                />

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-5 pb-3">
                    {attachments.map((a, i) => (
                      <div key={i} className="relative group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                        {a.type.startsWith('image/') ? (
                          <img src={a.dataUrl} className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <iconify-icon icon="solar:document-linear" width="14" />
                        )}
                        <span className="max-w-[120px] truncate">{a.name}</span>
                        <button onClick={() => removeAttachment(i)} className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity">
                          <iconify-icon icon="solar:close-circle-bold" width="13" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between px-4 pb-4 pt-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => imageInputRef.current?.click()} title="Attach image" className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <iconify-icon icon="solar:gallery-linear" width="16" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Attach file" className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <iconify-icon icon="solar:paperclip-linear" width="16" />
                    </button>
                    <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.2)' }}>⌘↵ to send</span>
                  </div>
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:opacity-80 disabled:opacity-50 active:scale-95"
                    style={{ backgroundColor: '#f91814' }}
                  >
                    {isSubmitting
                      ? <iconify-icon icon="solar:refresh-linear" width="15" style={{ color: '#ffffff' }} className="animate-spin" />
                      : <iconify-icon icon="solar:arrow-up-linear" width="15" style={{ color: '#ffffff' }} />}
                  </button>
                </div>
              </div>

              {error && <p className="mt-2 text-xs text-center" style={{ color: '#f91814' }}>{error}</p>}
            </>
          )}
        </div>
      </section>

      {/* ── HARNESSES / HOW IT WORKS ── */}
      <section id="harnesses" className="py-24 md:py-32 relative overflow-hidden bg-[#f91814]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p
              className="text-xl md:text-2xl tracking-tight mb-4 uppercase text-white"
              style={{ fontFamily: mousememoirs }}
            >
              The Harnesses
            </p>
            <h2
              className="text-4xl md:text-5xl tracking-tighter leading-tight text-white mb-6"
              style={{ fontFamily: bowlby }}
            >
              MESSY INPUT. CLEAN SPEC.
            </h2>
            <p className="max-w-lg mx-auto text-white/80 text-sm font-medium tracking-tight leading-relaxed">
              Klien kirim voice note, screenshot, Notion dump. SANDWICH ubah semua itu jadi structured, machine-readable specs — tervalidasi dan siap dieksekusi agent kamu.
            </p>
          </div>

          <div className="flex flex-row items-center justify-center gap-10 mt-8">
            {/* Left — output types */}
            <div className="flex flex-col gap-10 items-start shrink-0 text-xs uppercase tracking-tight font-medium text-white">
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-10deg)' }}>
                <iconify-icon icon="solar:document-text-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>PRD</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-5deg)' }}>
                <iconify-icon icon="solar:notes-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>MOM</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(4deg)' }}>
                <iconify-icon icon="solar:widget-2-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Prototype</span>
              </div>
            </div>

            {/* Center — steps illustration */}
            <div className="flex flex-col items-center gap-3 w-72 md:w-96 shrink-0">
              {[
                { step: '01', label: 'Kasih Brief', desc: 'Input kasar, bahasa apapun' },
                { step: '02', label: 'AI Proses', desc: 'Order → Prep → Recipe' },
                { step: '03', label: 'Dapat Spec', desc: 'PRD, MOM, Quotation' },
                { step: '04', label: 'Agent Eksekusi', desc: 'Claude, Pi, atau Codex' },
              ].map((s) => (
                <div
                  key={s.step}
                  className="w-full rounded-2xl px-5 py-4 flex items-center gap-4"
                  style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <span className="text-xs font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: bowlby }}>{s.step}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white tracking-tight">{s.label}</p>
                    <p className="text-xs text-white/50 mt-0.5">{s.desc}</p>
                  </div>
                  <iconify-icon icon="solar:arrow-right-linear" className="text-white/30 text-base" style={{strokeWidth: 1.5}}></iconify-icon>
                </div>
              ))}
            </div>

            {/* Right — output types */}
            <div className="flex flex-col gap-10 items-start shrink-0 text-xs uppercase tracking-tight font-medium text-white">
              <div className="flex items-center gap-3" style={{ transform: 'rotate(10deg)' }}>
                <iconify-icon icon="solar:pen-new-square-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Write Spec</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(5deg)' }}>
                <iconify-icon icon="solar:list-check-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Structure the Brief</span>
              </div>
              <div className="flex items-center gap-3" style={{ transform: 'rotate(-4deg)' }}>
                <iconify-icon icon="solar:money-bag-linear" className="text-xl" style={{strokeWidth: 1.5}}></iconify-icon>
                <span>Quotation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE ── */}
      <section id="pipeline" className="py-24 md:py-32 bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-2xl tracking-tight mb-4 uppercase text-[#f91814]" style={{ fontFamily: mousememoirs }}>Got a Spec?</p>
          <h2 className="text-4xl md:text-6xl tracking-tighter leading-tight text-white mb-8" style={{ fontFamily: bowlby }}>
            FEED YOUR<br />PIPELINE.
          </h2>
          <p className="text-sm text-white/60 font-medium leading-relaxed tracking-tight max-w-lg">
            SANDWICH was built because there's always been a gap between what a client describes and what an agent can execute. The spec closes that gap. What you do with it next depends on your stack — but if you're looking for a starting point, we recommend{' '}
            <a href="https://superpowers.obra.studio" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4 hover:text-[#f91814] transition-colors">Superpowers by Obra</a>.
            {' '}It's what we reach for.
          </p>
          <div className="flex items-center gap-4 mt-12">
            <span className="text-sm font-bold uppercase tracking-widest text-white">SANDWICH</span>
            <span className="text-white/30">→</span>
            <a href="https://superpowers.obra.studio" target="_blank" rel="noreferrer" className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">Superpowers</a>
          </div>
          <div className="mt-12">
            <button
              onClick={onGoToApp}
              className="inline-flex items-center gap-2 bg-[#f91814] text-white px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight hover:bg-red-700 transition-colors shadow-md shadow-red-500/20"
            >
              Coba Sekarang
              <iconify-icon icon="solar:arrow-right-up-linear" style={{strokeWidth: 1.5}}></iconify-icon>
            </button>
          </div>
        </div>
      </section>

      {/* ── STACK / INGREDIENTS ── */}
      <section id="about" className="py-24 md:py-32 bg-[#F4EBE1]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <p className="text-2xl tracking-tight mb-4 uppercase text-[#f91814]" style={{ fontFamily: mousememoirs }}>
            Ingredients
          </p>
          <h2 className="text-4xl md:text-6xl tracking-tighter leading-tight mb-6 text-black" style={{ fontFamily: bowlby }}>
            WHAT'S IN THE STACK
          </h2>
          <p className="max-w-lg mx-auto text-black/50 mb-16 text-sm font-medium tracking-tight leading-relaxed">
            Empat layer, masing-masing punya tugas. Bersama-sama mengubah chaos klien jadi spec yang bisa langsung dieksekusi agent kamu.
          </p>
          <div className="flex flex-row justify-center items-start gap-16 md:gap-24">
            {[
              { img: 'https://www.cravburgers.shop/img-webp/tomato.webp', name: '/ Order', desc: 'Structures the brief', offset: false },
              { img: 'https://www.cravburgers.shop/img-webp/cheese.webp', name: '/ Prep', desc: 'Scores impact', offset: true },
              { img: 'https://www.cravburgers.shop/img-webp/meat.webp', name: '/ Recipe', desc: 'Writes the spec', offset: false },
              { img: 'https://www.cravburgers.shop/img-webp/lettuce.webp', name: '/ Validate', desc: 'Checks confidence', offset: true },
            ].map((item) => (
              <div key={item.name} className={`flex flex-col items-center text-center w-36 md:w-40 ${item.offset ? 'translate-y-8' : ''}`}>
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-36 h-36 object-contain drop-shadow-md mb-5 hover:scale-110 transition-transform duration-500"
                />
                <h4 className="tracking-tight text-black font-bold text-base uppercase">{item.name}</h4>
                <p className="text-xs text-black/50 mt-1 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-[#F9CD25]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p
              className="text-2xl uppercase tracking-tight mb-4 text-white"
              style={{ fontFamily: mousememoirs }}
            >
              Pricing
            </p>
            <h2
              className="text-4xl md:text-5xl tracking-tighter mb-6 leading-tight text-white"
              style={{ fontFamily: bowlby }}
            >
              HARGA SIMPEL.<br />TANPA KEJUTAN.
            </h2>
            <p className="text-sm font-semibold leading-relaxed max-w-sm mx-auto text-white">
              Pilihan jelas untuk kebutuhan berbeda. Mulai gratis, upgrade kapan saja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-3xl overflow-hidden hover:-translate-y-1 transition-transform duration-300"
                style={{ backgroundColor: plan.highlight ? '#000000' : '#ffffff' }}
              >
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-start justify-between mb-6">
                    <span className="text-lg font-semibold" style={{ color: plan.highlight ? '#ffffff' : '#111827' }}>{plan.name}</span>
                    {plan.highlight && (
                      <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
                        Paling worth it
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 flex-wrap mb-1">
                    <span className="font-bold" style={{ fontSize: '2.5rem', lineHeight: 1, color: plan.highlight ? '#ffffff' : '#111827' }}>{plan.price}</span>
                    <span className="text-sm ml-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>{plan.priceNote}</span>
                    {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: plan.highlight ? 'rgba(255,255,255,0.4)' : '#d1d5db' }}>{plan.oldPrice}</span>}
                  </div>
                  <p className="text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>{plan.desc}</p>
                </div>

                <div className="px-6 pb-5">
                  <button
                    onClick={onGoToApp}
                    className="w-full py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                    style={plan.highlight
                      ? { backgroundColor: '#f91814', color: '#ffffff' }
                      : { backgroundColor: '#111827', color: '#ffffff' }
                    }
                  >
                    {plan.cta}
                  </button>
                </div>

                <ul className="flex flex-col gap-3 px-6 py-5 flex-1 border-t" style={{ borderColor: plan.highlight ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                      <iconify-icon
                        icon="solar:check-circle-linear"
                        width="15"
                        style={{ color: plan.highlight ? '#f91814' : '#9ca3af', flexShrink: 0, marginTop: '2px' }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 md:py-32 bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <p
              className="text-xl md:text-2xl tracking-tight mb-4 uppercase text-[#f91814]"
              style={{ fontFamily: mousememoirs }}
            >
              Shout Out
            </p>
            <h2
              className="text-4xl md:text-6xl tracking-tighter leading-tight text-white"
              style={{ fontFamily: bowlby }}
            >
              GOT QUESTIONS?
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-zinc-800">
            {FAQS.map((faq, i) => (
              <details key={i} className="group py-6" open={openFaq === i} onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i) }}>
                <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                  <span className="text-base font-semibold text-white tracking-tight">{faq.q}</span>
                  <iconify-icon
                    icon="solar:alt-arrow-down-linear"
                    className={`text-[#f91814] text-xl shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                  ></iconify-icon>
                </summary>
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed font-medium">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-14 text-center">
            <button
              onClick={onGoToApp}
              className="inline-flex items-center gap-2 bg-[#f91814] text-white px-8 py-3.5 rounded-full font-medium text-xs uppercase tracking-tight hover:bg-red-700 transition-colors shadow-md shadow-red-500/20"
            >
              Mulai Sekarang
              <iconify-icon icon="solar:arrow-right-up-linear" style={{strokeWidth: 1.5}}></iconify-icon>
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 text-white bg-black border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-medium text-white/40">© 2026 SANDWICH by Etalas</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/etalas-studio/sandwich-2" target="_blank" rel="noreferrer" className="text-xs font-medium text-white/70 hover:text-white transition-colors">GitHub</a>
            <a href="https://etalas.com" target="_blank" rel="noreferrer" className="text-xs font-medium text-white/70 hover:text-white transition-colors">Etalas</a>
            <a href="https://twitter.com/etalasworks" target="_blank" rel="noreferrer" className="text-xs font-medium text-white/70 hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
