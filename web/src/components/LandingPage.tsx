import { useState, useEffect, useRef, useCallback } from 'react'
import { createTicket } from '../api/tickets'
import { saveTicket } from '../lib/localTickets'

interface LandingPageProps {
  onGoToApp: () => void
}

const bowlby = "'Bowlby One', system-ui"

const NAV_SECTIONS = [
  { id: 'hero', label: 'Home' },
  { id: 'harnesses', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'stack', label: 'Stack' },

  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]

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
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no lock-in. Cancel from your account settings and you keep access until the end of the billing period.',
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
    badge: null,
    oldPrice: null,
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
    badge: 'Paling worth it',
  },
]

interface AttachedFile {
  name: string
  type: string
  dataUrl: string
}

// Keyframes from axisflow-saas DNA — animationIn + marquee-scroll
const KEYFRAMES = `
  @keyframes animationIn {
    0% { opacity: 0; transform: translateY(24px); filter: blur(6px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
  }
  @keyframes marquee-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .anim-in { animation: animationIn 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .anim-in-d1 { animation-delay: 0.06s; }
  .anim-in-d2 { animation-delay: 0.14s; }
  .anim-in-d3 { animation-delay: 0.22s; }
  .anim-in-d4 { animation-delay: 0.32s; }
  .marquee-track { animation: marquee-scroll 28s linear infinite; }
`

export default function LandingPage({ onGoToApp }: LandingPageProps) {
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState('hero')
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.3 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) return
    const navCenter = nav.scrollLeft + nav.clientWidth / 2
    const itemCenter = active.offsetLeft + active.clientWidth / 2
    nav.scrollTo({ left: nav.scrollLeft + itemCenter - navCenter, behavior: 'smooth' })
  }, [activeSection])

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
      className="min-h-screen flex flex-col overflow-x-hidden selection:bg-[#f91814] selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#ffffff' }}
    >
      <style>{KEYFRAMES}</style>

      {/* ── NAV — glass light, axisflow-style backdrop blur ── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          ref={navRef}
          className="flex items-center gap-1 px-2 py-1.5 rounded-full border"
          style={{
            backgroundColor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(0,0,0,0.08)',
            boxShadow: '0 2px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
          }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center mr-1" style={{ backgroundColor: '#f91814' }}>
            <span className="text-white font-black text-[10px]" style={{ fontFamily: bowlby }}>S</span>
          </div>

          {[
            { id: 'features', label: 'Features' },
            { id: 'harnesses', label: 'How It Works' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'faq', label: 'FAQ' },
          ].map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              data-active={activeSection === id}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors hover:text-black"
              style={{ color: activeSection === id ? '#0a0a0a' : '#6b7280' }}
            >
              {label}
            </a>
          ))}

          <button
            onClick={onGoToApp}
            className="ml-1 px-4 py-1.5 rounded-full text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.18)',
            }}
          >
            Get Started
          </button>
        </nav>
      </div>

      {/* ── SECTION 1: HERO ── */}
      <section
        id="hero"
        className="relative flex flex-col items-center text-center px-6 overflow-hidden"
        style={{ backgroundColor: '#fafafa', minHeight: '100vh', paddingTop: '120px', paddingBottom: '120px' }}
      >
        {/* floating document cards — softer shadows */}
        <div className="absolute hidden lg:block" style={{ top: '110px', left: '5%', transform: 'rotate(-2deg)' }}>
          <div className="w-44 rounded-xl border p-3 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#f91814' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#f91814' }}>PRD</span>
            </div>
            <div className="h-1.5 rounded mb-1.5 w-full" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="h-1.5 rounded mb-1.5 w-4/5" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="h-1.5 rounded mb-2 w-3/4" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="text-[8px] font-medium" style={{ color: '#9ca3af' }}>User stories · Acceptance criteria</div>
          </div>
        </div>

        <div className="absolute hidden lg:block" style={{ top: '120px', right: '5%', transform: 'rotate(2deg)' }}>
          <div className="w-44 rounded-xl border p-3 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#f97316' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#f97316' }}>Quotation</span>
            </div>
            <div className="flex justify-between mb-1">
              <div className="h-1.5 rounded w-2/5" style={{ backgroundColor: '#f3f4f6' }} />
              <div className="h-1.5 rounded w-1/4" style={{ backgroundColor: '#fef3c7' }} />
            </div>
            <div className="flex justify-between mb-2">
              <div className="h-1.5 rounded w-3/5" style={{ backgroundColor: '#f3f4f6' }} />
              <div className="h-1.5 rounded w-1/4" style={{ backgroundColor: '#fef3c7' }} />
            </div>
            <div className="text-[8px] font-medium" style={{ color: '#9ca3af' }}>Total · Rp 24,500,000</div>
          </div>
        </div>

        <div className="absolute hidden lg:block" style={{ top: '42%', left: '3%' }}>
          <div className="w-40 rounded-xl border p-3 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#16a34a' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#16a34a' }}>MOM</span>
            </div>
            <div className="h-1.5 rounded mb-1 w-full" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="h-1.5 rounded mb-1 w-3/4" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="text-[8px] font-medium mt-1" style={{ color: '#9ca3af' }}>Action items · 4 tasks</div>
          </div>
        </div>

        <div className="absolute hidden lg:block" style={{ top: '42%', right: '3%' }}>
          <div className="w-40 rounded-xl border p-3 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#6366f1' }}>Brief Klien</span>
            </div>
            <div className="h-1.5 rounded mb-1 w-full" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="h-1.5 rounded mb-1 w-4/5" style={{ backgroundColor: '#f3f4f6' }} />
            <div className="text-[8px] font-medium mt-1" style={{ color: '#9ca3af' }}>Scope · Timeline · Budget</div>
          </div>
        </div>

        {/* center-top logo mark */}
        <div className="absolute hidden lg:block" style={{ top: '88px', left: '50%', transform: 'translateX(-50%)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f91814', boxShadow: '0 4px 16px rgba(249,24,20,0.22)' }}>
            <span className="text-white font-black text-lg" style={{ fontFamily: bowlby }}>S</span>
          </div>
        </div>

        {/* dashed SVG connectors — lighter */}
        <svg className="absolute inset-0 w-full h-full hidden lg:block pointer-events-none" style={{ zIndex: 0 }}>
          <line x1="50%" y1="136" x2="22%" y2="55%" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="50%" y1="136" x2="78%" y2="55%" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="50%" y1="136" x2="10%" y2="42%" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 5" />
          <line x1="50%" y1="136" x2="90%" y2="42%" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 5" />
          <circle cx="22%" cy="55%" r="3" fill="#e5e7eb" />
          <circle cx="78%" cy="55%" r="3" fill="#e5e7eb" />
          <circle cx="10%" cy="42%" r="3" fill="#e5e7eb" />
          <circle cx="90%" cy="42%" r="3" fill="#e5e7eb" />
        </svg>

        <div className="relative z-10 flex flex-col items-center w-full mt-16">
          {/* badge — animationIn delay 0 */}
          <div
            className="anim-in anim-in-d1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 text-sm"
            style={{ borderColor: '#e5e7eb', color: '#6b7280', backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f91814' }} />
            Dipakai oleh tim produk di Indonesia
          </div>

          {/* headline — lifted to clamp(3.5rem, 7vw, 6rem) — meets text-5xl+ floor */}
          <h1
            className="anim-in anim-in-d2 font-medium leading-[0.95] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)', color: '#0a0a0a', maxWidth: '700px' }}
          >
            Dari brief berantakan<br />jadi spek siap eksekusi
          </h1>

          <p className="anim-in anim-in-d3 mb-10 text-lg leading-relaxed" style={{ color: '#6b7280', maxWidth: '520px' }}>
            Sandwich AI mengubah input klien kasar menjadi{' '}
            <span className="font-medium" style={{ color: '#f91814' }}>PRD</span>,{' '}
            <span className="font-medium" style={{ color: '#ea580c' }}>prototype brief</span>,{' '}
            <span className="font-medium" style={{ color: '#16a34a' }}>MOM</span>{' '}
            — langsung siap dikerjakan tim.
          </p>

          <div className="anim-in anim-in-d4 w-full max-w-xl mt-4">
            {submitted ? (
              <div className="rounded-2xl p-8 text-center border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f91814' }}>
                  <iconify-icon icon="solar:check-circle-bold" width="24" style={{ color: '#ffffff' }} />
                </div>
                <p className="font-semibold text-zinc-900 mb-1">Ticket dibuat!</p>
                <p className="text-sm text-zinc-400 mb-5">Pipeline sedang memproses brief kamu. Cek hasilnya di dashboard.</p>
                <button
                  onClick={onGoToApp}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white mx-auto hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#0a0a0a' }}
                >
                  Lihat hasil
                  <iconify-icon icon="solar:arrow-right-linear" width="14" />
                </button>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />

                {/* SANDWICH AI tag — stacks behind from top */}
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl relative z-0 -mb-8"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,243,255,0.9) 0%, rgba(240,248,255,0.9) 100%)',
                    border: '1px solid rgba(200,195,255,0.4)',
                  }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #6c63ff, #4a90d9)' }}>
                    <iconify-icon icon="solar:magic-stick-3-bold" width="14" style={{ color: '#ffffff' }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wide" style={{ color: '#111827' }}>SANDWICH AI</p>
                    <p className="text-[11px]" style={{ color: '#6b7280' }}>Powered by Claude & GPT</p>
                  </div>
                </div>

                {/* prompt card */}
                <div
                  className="rounded-2xl overflow-hidden relative z-10"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* chips row — top of card */}
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
                        style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* textarea */}
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ceritain project atau brief kamu di sini…"
                    rows={4}
                    className="w-full resize-none bg-transparent text-zinc-800 text-sm outline-none px-5 pt-3 pb-2 leading-relaxed placeholder:text-zinc-300"
                  />

                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-5 pb-3">
                      {attachments.map((a, i) => (
                        <div key={i} className="relative group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#f4f4f5', color: '#3f3f46' }}>
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

                  {/* bottom bar */}
                  <div className="flex items-center justify-between px-4 pb-4 pt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => imageInputRef.current?.click()} title="Attach image" className="p-1.5 rounded-lg transition-colors hover:bg-zinc-100" style={{ color: '#9ca3af' }}>
                        <iconify-icon icon="solar:gallery-linear" width="16" />
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} title="Attach file" className="p-1.5 rounded-lg transition-colors hover:bg-zinc-100" style={{ color: '#9ca3af' }}>
                        <iconify-icon icon="solar:paperclip-linear" width="16" />
                      </button>
                      <span className="text-xs ml-1" style={{ color: '#d4d4d8' }}>⌘↵ to send</span>
                    </div>
                    <button
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting}
                      className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:opacity-80 disabled:opacity-50 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #6c63ff, #4a90d9)' }}
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
        </div>
      </section>

      {/* ── SECTION 2: HOW IT WORKS ── */}
      <section id="harnesses" className="py-24" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="max-w-6xl mx-auto px-8">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <div className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: '#4a90e2' }}>
                <iconify-icon icon="solar:shield-check-linear" width="14" />
                Core Service
              </div>
              <h2 className="font-bold leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#111827', letterSpacing: '-0.02em', maxWidth: '520px' }}>
                Dari Brief Berantakan<br />
                <span style={{ color: '#9ca3af' }}>Jadi Spec Siap Eksekusi</span>
              </h2>
            </div>
            <p className="text-base leading-relaxed md:max-w-xs" style={{ color: '#6b7280' }}>
              Tiga langkah sederhana — dari input kasar klien sampai spec yang langsung bisa dijalankan AI agent lo.
            </p>
          </div>

          {/* 4-col cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: 'solar:inbox-in-linear',
                bg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                title: 'Kasih Brief',
                desc: 'Ceritain project dalam bahasa apapun — kasar, campur, atau copy-paste dari klien langsung.',
              },
              {
                icon: 'solar:magic-stick-3-linear',
                bg: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                title: 'SANDWICH Proses',
                desc: 'AI parse brief lo, identifikasi kebutuhan, dan strukturkan jadi format spec yang konsisten.',
              },
              {
                icon: 'solar:document-text-linear',
                bg: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                title: 'Dapat Dokumen',
                desc: 'PRD, prototype brief, MOM, atau quotation — siap pakai tanpa editing ulang.',
              },
              {
                icon: 'solar:rocket-linear',
                bg: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                title: 'AI Agent Eksekusi',
                desc: 'Spec langsung bisa dijalankan Claude Code, Pi, atau Codex — no guessing, pure execution.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-2xl p-5 border"
                style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
              >
                {/* icon — large, top-left, square rounded */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10"
                  style={{ background: card.bg }}
                >
                  <iconify-icon icon={card.icon} width="24" style={{ color: '#ffffff' }} />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: '#111827' }}>{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ── SECTION 4: PIPELINE — split: feature list left + UI preview right ── */}
      <section id="pipeline" className="py-28" style={{ backgroundColor: '#ffffff', borderTop: '1px solid #f3f4f6' }}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* LEFT — feature list */}
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
                Got a Spec?
              </p>
              <h2
                className="font-medium leading-[0.95] tracking-tight mb-6"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', color: '#0a0a0a' }}
              >
                Feed Your<br />Pipeline.
              </h2>
              <p className="text-base leading-relaxed mb-10" style={{ color: '#6b7280', maxWidth: '420px' }}>
                SANDWICH was built because there's always been a gap between what a client describes and what an agent can execute. The spec closes that gap.
              </p>

              <div className="flex flex-col gap-5">
                {[
                  {
                    icon: 'solar:chart-2-linear',
                    color: '#f97316',
                    title: 'Drive Revenue With Confidence',
                    desc: 'Get real-time insights on your pipeline operations. Track delivery rates, spec quality scores, and agent performance to make confident decisions.',
                  },
                  {
                    icon: 'solar:layers-linear',
                    color: '#6366f1',
                    title: 'All-In-One, Yet Exceptionally Simple',
                    desc: 'From brief intake to validated spec in one flow. No config, no toolchain — paste a brief and get output your agent can act on immediately.',
                  },
                  {
                    icon: 'solar:shield-check-linear',
                    color: '#16a34a',
                    title: 'Reliable, Secure, And Future-Ready',
                    desc: 'Built on a deterministic pipeline that checks its own confidence. If a spec is weak, SANDWICH flags it before your agent wastes a cycle.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}18`, border: `1.5px solid ${item.color}28` }}
                    >
                      <iconify-icon icon={item.icon} width="18" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1" style={{ color: '#0a0a0a' }}>{item.title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — mock dashboard UI */}
            <div className="relative flex items-center justify-center">
              {/* green ambient glow */}
              <div style={{ position: 'absolute', inset: '-20px', background: 'radial-gradient(ellipse 80% 70% at 55% 45%, rgba(134,239,172,0.12) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

              <div
                className="relative w-full rounded-3xl overflow-hidden"
                style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', boxShadow: '0 24px 64px rgba(0,0,0,0.07)', maxWidth: '460px', zIndex: 1 }}
              >
                {/* titlebar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f91814' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f97316' }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                  <div className="flex-1 mx-3 h-5 rounded-md" style={{ backgroundColor: '#f3f4f6' }} />
                </div>

                <div className="p-5 flex flex-col gap-4">
                  {/* gauge card */}
                  <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold" style={{ color: '#0a0a0a' }}>Spec Quality Rate</p>
                      <iconify-icon icon="solar:menu-dots-bold" width="16" style={{ color: '#9ca3af' }} />
                    </div>
                    <div className="flex justify-center">
                      <svg width="160" height="92" viewBox="0 0 160 92">
                        <path d="M 16 86 A 64 64 0 0 1 144 86" fill="none" stroke="#f3f4f6" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 16 86 A 64 64 0 0 1 133 40" fill="none" stroke="#16a34a" strokeWidth="12" strokeLinecap="round" />
                        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0a0a0a">87%</text>
                        <text x="80" y="90" textAnchor="middle" fontSize="8" fill="#9ca3af">Confidence Score</text>
                      </svg>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>+4.2%</span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>vs last week</span>
                    </div>
                  </div>

                  {/* stats row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4 bg-white border" style={{ borderColor: '#e5e7eb' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs" style={{ color: '#9ca3af' }}>Specs Generated</p>
                        <iconify-icon icon="solar:graph-up-linear" width="13" style={{ color: '#16a34a' }} />
                      </div>
                      <p className="text-xl font-bold mb-1" style={{ color: '#0a0a0a' }}>2,543</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>+4.2%</span>
                    </div>
                    <div className="rounded-xl p-4 bg-white border" style={{ borderColor: '#e5e7eb' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs" style={{ color: '#9ca3af' }}>Total Value</p>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
                          <iconify-icon icon="solar:dollar-minimalistic-linear" width="10" style={{ color: '#fff' }} />
                        </div>
                      </div>
                      <p className="text-lg font-bold leading-tight mb-1" style={{ color: '#0a0a0a' }}>Rp 68,8jt</p>
                      <span className="text-[9px]" style={{ color: '#16a34a' }}>+2.0% vs Last Week</span>
                    </div>
                  </div>

                  {/* pipeline progress bars */}
                  <div className="rounded-xl p-4 bg-white border" style={{ borderColor: '#e5e7eb' }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: '#6b7280' }}>Active Pipeline</p>
                    <div className="flex gap-2">
                      {[
                        { label: 'ORDER', color: '#f91814', pct: '100%' },
                        { label: 'PREP', color: '#f97316', pct: '87%' },
                        { label: 'RECIPE', color: '#16a34a', pct: '72%' },
                        { label: 'VALIDATE', color: '#6366f1', pct: '65%' },
                      ].map((s) => (
                        <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', backgroundColor: '#f3f4f6' }}>
                            <div className="h-full rounded-full" style={{ width: s.pct, backgroundColor: s.color }} />
                          </div>
                          <span className="text-[8px] font-semibold tracking-wider" style={{ color: '#9ca3af' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* ── SECTION 8: FAQ ── */}
      <section id="faq" className="py-24" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-14">
            <div className="inline-block px-4 py-2 rounded-full text-sm mb-6" style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
              Frequently Asked Questions
            </div>
            <h2 className="font-extrabold leading-tight mb-4" style={{ color: '#0f172a', fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '-0.03em' }}>
              Semua yang Kamu<br />Mungkin Tanyakan.
            </h2>
            <p className="text-base max-w-md mx-auto" style={{ color: '#64748b' }}>
              Jawaban jelas untuk pertanyaan umum, supaya kamu bisa fokus pada hasil.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  style={{ backgroundColor: '#ffffff' }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium pr-4" style={{ color: '#111827', fontSize: '1rem' }}>{faq.q}</span>
                  <iconify-icon
                    icon={openFaq === i ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                    width="18"
                    style={{ color: '#9ca3af', flexShrink: 0 }}
                  />
                </button>
                {openFaq === i && (
                  <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: '#6b7280' }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border flex items-center justify-between px-7 py-6 mt-4" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
            <div>
              <p className="font-bold text-lg mb-1" style={{ color: '#111827' }}>Masih ada pertanyaan?</p>
              <p className="text-sm" style={{ color: '#6b7280' }}>Kalau belum ketemu jawabannya, tim kami siap bantu.</p>
            </div>
            <a
              href="https://www.etalas.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold text-white whitespace-nowrap hover:opacity-90 transition-opacity ml-6"
              style={{ backgroundColor: '#0a0a0a' }}
            >
              <iconify-icon icon="solar:phone-linear" width="15" />
              Hubungi Kami
            </a>
          </div>
        </div>
      </section>
      {/* ── SECTION 7: PRICING ── */}
      <section id="pricing" className="py-24" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full text-sm mb-5" style={{ backgroundColor: '#e5e7eb', color: '#6b7280' }}>
              Plans &amp; Pricing
            </div>
            <h2 className="font-bold leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#111827', letterSpacing: '-0.02em' }}>
              Harga Simpel,<br />Tanpa Kejutan.
            </h2>
            <p className="text-base" style={{ color: '#9ca3af' }}>
              Pilihan jelas untuk kebutuhan berbeda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-2xl border overflow-hidden"
                style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
              >
                {/* Top header */}
                {plan.highlight ? (
                  <div
                    className="relative px-5 pt-5 pb-6"
                    style={{
                      background: 'linear-gradient(160deg, #2d2d2d 0%, #111111 50%, #1a1a1a 100%)',
                      minHeight: '160px',
                    }}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <span className="text-lg font-semibold" style={{ color: '#ffffff' }}>{plan.name}</span>
                      {plan.badge && (
                        <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.85)', color: '#374151' }}>
                          Paling populer
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-bold" style={{ fontSize: '2.8rem', lineHeight: 1, color: '#ffffff' }}>{plan.price}</span>
                      <span className="text-sm ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{plan.priceNote}</span>
                      {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{plan.oldPrice}</span>}
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{plan.desc}</p>
                  </div>
                ) : (
                  <div className="px-5 pt-5 pb-6" style={{ backgroundColor: '#f9fafb', minHeight: '160px' }}>
                    <span className="text-lg font-semibold block mb-5" style={{ color: '#111827' }}>{plan.name}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold" style={{ fontSize: '2.8rem', lineHeight: 1, color: '#9ca3af' }}>{plan.price}</span>
                      <span className="text-sm ml-1" style={{ color: '#9ca3af' }}>{plan.priceNote}</span>
                      {plan.oldPrice && <span className="text-sm line-through ml-2" style={{ color: '#d1d5db' }}>{plan.oldPrice}</span>}
                    </div>
                    <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{plan.desc}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="px-5 py-4 border-t" style={{ borderColor: '#f3f4f6' }}>
                  <button
                    onClick={onGoToApp}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                    style={plan.highlight
                      ? { backgroundColor: '#111827', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#111827', border: '1px solid #e5e7eb' }
                    }
                  >
                    {plan.cta}
                  </button>
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-3 px-5 py-5 flex-1 border-t" style={{ borderColor: '#f3f4f6' }}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm" style={{ color: '#374151' }}>
                      {plan.highlight ? (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#111827' }}>
                          <iconify-icon icon="solar:check-linear" width="11" style={{ color: '#ffffff' }} />
                        </span>
                      ) : (
                        <iconify-icon icon="solar:check-linear" width="14" style={{ color: '#9ca3af', flexShrink: 0 }} />
                      )}
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6" style={{ backgroundColor: '#f8f9fa' }}>
        <div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative text-center py-28 px-8"
          style={{
            background: 'linear-gradient(180deg, #7ba7d4 0%, #a8c4e0 40%, #c8dced 75%, #dde9f3 100%)',
            minHeight: '400px',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 140% 60% at 50% 130%, rgba(255,255,255,0.6) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: 'radial-gradient(ellipse 80% 100% at 20% 120%, rgba(255,255,255,0.5) 0%, transparent 60%), radial-gradient(ellipse 80% 100% at 80% 120%, rgba(255,255,255,0.5) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div className="relative z-10">
            <div
              className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium mb-8"
              style={{ backgroundColor: 'rgba(255,255,255,0.35)', color: '#1e3a5f', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.5)' }}
            >
              Siap Mulai?
            </div>
            <h2 className="font-extrabold text-white leading-tight mb-4" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', letterSpacing: '-0.03em', textShadow: '0 1px 20px rgba(0,0,0,0.12)' }}>
              Spec Siap Eksekusi<br />dalam Hitungan Menit
            </h2>
            <p className="mb-10 text-base leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Kasih brief kasar dari klien — SANDWICH ubah jadi spec yang langsung bisa dijalankan AI agent lo.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={onGoToApp}
                className="inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-full transition-all hover:opacity-90"
                style={{ backgroundColor: '#ffffff', color: '#111827', fontSize: '0.95rem' }}
              >
                <iconify-icon icon="solar:play-circle-linear" width="18" />
                Coba Gratis
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-full transition-all hover:bg-white/20"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}
              >
                <iconify-icon icon="solar:compass-linear" width="18" />
                Lihat Fitur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #f3f4f6' }}>
        <div className="max-w-6xl mx-auto px-8 py-16" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '3rem' }}>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
                <span className="text-white text-[9px] font-black" style={{ fontFamily: bowlby }}>S</span>
              </div>
              <span className="font-bold text-sm" style={{ fontFamily: bowlby, color: '#0a0a0a', letterSpacing: '0.04em' }}>SANDWICH</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b7280', maxWidth: '220px' }}>
              Dari brief berantakan jadi spek yang siap dieksekusi.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-5" style={{ color: '#9ca3af' }}>Platform</p>
            {['How it works', 'Features', 'Pipeline', 'Pricing', 'FAQ'].map((item) => (
              <a
                key={item}
                href="#"
                className="block text-sm mb-3 transition-colors hover:text-gray-900"
                style={{ color: '#6b7280' }}
                onClick={(e) => {
                  e.preventDefault()
                  const id = NAV_SECTIONS.find(s => s.label === item)?.id
                  if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {item}
              </a>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-5" style={{ color: '#9ca3af' }}>Company</p>
            {[
              { label: 'About Etalas', href: 'https://www.etalas.com/' },
              { label: 'GitHub', href: 'https://github.com/etalas-studio/sandwich-2' },
              { label: 'Contact', href: 'https://www.etalas.com/' },
            ].map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="block text-sm mb-3 transition-colors hover:text-gray-900" style={{ color: '#6b7280' }}>
                {item.label}
              </a>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-5" style={{ color: '#9ca3af' }}>Social</p>
            {[
              { label: 'Twitter / X', href: 'https://twitter.com/etalas_studio' },
              { label: 'Instagram', href: 'https://www.etalas.com/' },
              { label: 'LinkedIn', href: 'https://www.etalas.com/' },
            ].map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="block text-sm mb-3 transition-colors hover:text-gray-900" style={{ color: '#6b7280' }}>
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="border-t px-8 py-5 flex items-center justify-between" style={{ borderColor: '#f3f4f6' }}>
          <span className="text-xs" style={{ color: '#9ca3af' }}>© 2026 SANDWICH by Etalas</span>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#9ca3af' }}>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms of service</a>
            <span>·</span>
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy policy</a>
          </div>
        </div>

        <div className="overflow-hidden px-8 pb-4 select-none pointer-events-none text-center" style={{ lineHeight: 1 }}>
          <p className="font-black" style={{ fontFamily: bowlby, fontSize: 'clamp(4rem, 14vw, 11rem)', color: '#f3f4f6', letterSpacing: '-0.02em' }}>
            SANDWICH
          </p>
        </div>
      </footer>
    </div>
  )
}
