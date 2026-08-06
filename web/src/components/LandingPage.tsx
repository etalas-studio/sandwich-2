import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket } from '../api/tickets'

interface LandingPageProps {
  isAuthenticated: boolean
  onGoToApp: () => void
}

const bowlby = "'Bowlby One', system-ui"

const NAV_SECTIONS = [
  { id: 'hero', label: 'Home' },
  { id: 'harnesses', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'stack', label: 'Stack' },
  { id: 'testimonials', label: 'Reviews' },
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



const FEATURES = [
  {
    icon: 'solar:document-add-linear',
    title: 'Structured briefs in seconds',
    body: 'Drop anything — a voice note, a Slack thread, a rambling email. SANDWICH extracts the intent and outputs a clean spec your agent can run with.',
  },
  {
    icon: 'solar:chart-linear',
    title: 'Impact scoring built in',
    body: 'Every spec gets a priority score based on effort, risk, and business value. No more guessing which ticket to tackle first.',
  },
  {
    icon: 'solar:shield-check-linear',
    title: 'Confidence validation',
    body: 'Before your agent touches a line of code, SANDWICH checks the spec for completeness, contradiction, and ambiguity. Catch gaps early.',
  },
  {
    icon: 'solar:refresh-circle-linear',
    title: 'Repeatable pipeline',
    body: 'Order → Prep → Recipe is the same every time. Consistent inputs mean consistent outputs — your agent stops hallucinating requirements.',
  },
  {
    icon: 'solar:users-group-rounded-linear',
    title: 'Built for teams',
    body: 'Shared ticket queue, role-based access, and audit trail. Everyone sees the same source of truth, from PM to agent.',
  },
  {
    icon: 'solar:plug-circle-linear',
    title: 'Connects your whole stack',
    body: 'Native GitHub, Jira, and Bitbucket integrations. Pull tickets in, push PRs out — without leaving the pipeline.',
  },
]

const TESTIMONIALS = [
  {
    quote: 'We cut our ticket-to-PR time by 60%. The spec quality alone was worth switching.',
    name: 'Marcus T.',
    role: 'Engineering Lead, Series A startup',
  },
  {
    quote: "Our client calls used to end with 3 pages of vague notes. Now they end with a SANDWICH spec that actually runs.",
    name: 'Priya S.',
    role: 'Freelance AI developer',
  },
  {
    quote: 'I gave it a Loom recording and a Notion link. It came back with a five-point spec that my agent shipped in one pass.',
    name: 'Dave L.',
    role: 'Solo founder',
  },
]

const PLANS = [
  {
    name: 'STARTER',
    price: 'Rp 50k',
    sub: '/ bulan',
    desc: 'Buat yang mulai serius.',
    features: [
      'Premium AI model',
      '5 PRD / bulan',
      'Chat AI: planning PRD, fitur, task (100× / bln)',
      'Download Markdown',
      'Generate specs untuk fitur dan task',
    ],
    cta: 'Mulai sekarang',
    highlight: false,
  },
  {
    name: 'PRO',
    price: 'Rp 100k',
    sub: '/ bulan',
    oldPrice: 'Rp 250k',
    desc: 'Unlimited, semua akses.',
    features: [
      'Premium AI model',
      'Unlimited PRD',
      'Chat AI: planning PRD, fitur, task (unlimited)',
      'Download Markdown',
      'Generate specs untuk fitur dan task',
      'Chat langsung dengan Raf Dev untuk bantuan',
    ],
    cta: 'Upgrade ke Pro',
    highlight: true,
    badge: 'Paling worth it',
  },
]

export default function LandingPage({ isAuthenticated, onGoToApp }: LandingPageProps) {
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState('hero')
  const navRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  // scroll active nav item into center
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) return
    const navCenter = nav.scrollLeft + nav.clientWidth / 2
    const itemCenter = active.offsetLeft + active.clientWidth / 2
    nav.scrollTo({ left: nav.scrollLeft + itemCenter - navCenter, behavior: 'smooth' })
  }, [activeSection])

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    if (!isAuthenticated) {
      navigate('/login', { state: { pendingPrompt: prompt } })
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const ticket = await createTicket({ id: '', summary: prompt.trim(), description: '', url: '' })
      navigate(`/old/tickets?selected=${ticket.key}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket')
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
      style={{ fontFamily: "'Inter', sans-serif" }}
    >

      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-black/5 flex items-center px-8 py-3 gap-6"
        style={{ backgroundColor: '#F4EBE1' }}
      >
        {/* Logo */}
        <span style={{ fontFamily: bowlby, fontSize: '1.1rem', color: '#1a1a1a', letterSpacing: '-0.01em', flexShrink: 0 }}>
          SANDWICH
        </span>

        {/* Section nav — centered */}
        <div
          ref={navRef}
          className="flex items-center gap-1 flex-1 justify-center overflow-x-auto hide-scrollbar"
          style={{ scrollbarWidth: 'none' }}
        >
          {NAV_SECTIONS.map(({ id, label }) => {
            const isActive = activeSection === id
            return (
              <a
                key={id}
                href={`#${id}`}
                data-active={isActive}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive ? '#f91814' : 'transparent',
                  color: isActive ? '#ffffff' : '#9ca3af',
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-4 shrink-0">
          {isAuthenticated ? (
            <button onClick={onGoToApp} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: '#f91814' }}>
              Open app →
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
                Sign in
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-sm px-4 py-1.5 rounded-full font-medium text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#f91814' }}
              >
                Get started free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── SECTION 1: HERO ── cream */}
      <section
        id="hero"
        className="relative pt-52 pb-24 flex flex-col items-center text-center px-6 overflow-hidden"
        style={{ backgroundColor: '#F4EBE1' }}
      >
        <div className="relative z-10 flex flex-col items-center">
          <h1 style={{ fontFamily: bowlby, fontSize: 'clamp(4rem, 12vw, 8rem)', color: '#f91814', lineHeight: 1, letterSpacing: '-0.02em' }}>
            SANDWICH
          </h1>
          <p className="mt-8 mb-10" style={{ fontFamily: bowlby, fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', color: '#F4A804', letterSpacing: '-0.01em' }}>
            Transform messy client input into development-ready specs
          </p>

          {/* Sandwich image */}
          <div className="relative w-72 h-72 flex items-center justify-center">
            <svg className="absolute top-4 right-8 w-8 h-8" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L17.5 14L16 26M2 16L14 17.5L26 16" stroke="#f91814" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <svg className="absolute top-6 right-2 w-5 h-5" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L17 14L16 24M4 16L14 17L24 16" stroke="#f91814" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <svg className="absolute bottom-8 left-4 w-10 h-6" viewBox="0 0 40 24" fill="none">
              <path d="M4 20 Q10 4 20 8 Q30 12 36 4" stroke="#f91814" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <svg className="absolute bottom-12 right-4 w-8 h-5" viewBox="0 0 32 20" fill="none">
              <path d="M28 16 Q22 2 14 6 Q8 10 4 4" stroke="#f91814" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <img
              src="https://etalasaccounts.github.io/sandwich/public/sandwich.webp"
              alt="Sandwich"
              className="w-60 h-60 object-contain drop-shadow-xl"
            />
          </div>

          <div className="w-full max-w-xl mt-10">
            <div className="rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you need built…"
                rows={3}
                className="w-full resize-none bg-transparent text-zinc-800 text-sm outline-none px-5 pt-4 pb-2 leading-relaxed placeholder:text-zinc-300 font-mono"
              />
              <div className="flex items-center justify-between px-4 pb-4 pt-1">
                <span className="text-xs text-zinc-300 font-mono">⌘↵ to send</span>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!prompt.trim() || isSubmitting}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-30 hover:opacity-80"
                  style={{ backgroundColor: '#f91814' }}
                >
                  {isSubmitting
                    ? <iconify-icon icon="solar:refresh-linear" width="13" className="animate-spin" />
                    : <iconify-icon icon="solar:arrow-right-linear" width="13" />
                  }
                  {isSubmitting ? 'Creating…' : 'Send to pipeline'}
                </button>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-center" style={{ color: '#f91814' }}>{error}</p>}
          </div>
        </div>
      </section>


      {/* ── SECTION 2: MESSY INPUT. CLEAN SPEC. ── red */}
      <section id="harnesses" className="py-28 relative overflow-hidden" style={{ backgroundColor: '#f91814' }}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-white/60 mb-4 uppercase" style={{ fontFamily: bowlby }}>
              The Harnesses
            </p>
            <h2 className="text-white leading-none mb-6" style={{ fontFamily: bowlby, fontSize: 'clamp(2.5rem, 8vw, 5.5rem)', letterSpacing: '-0.02em' }}>
              MESSY INPUT. CLEAN OUTPUT.
            </h2>
            <p className="text-white/80 text-base max-w-lg mx-auto leading-relaxed">
              Ceritain project lo, kasih brief kasar, atau paste format dari klien — SANDWICH ubah semuanya
              jadi PRD lengkap, prototype, MOM, sampai quotation yang siap kirim.
            </p>
          </div>

          <div className="flex flex-row items-center justify-center gap-10 mt-4">
            <div className="flex flex-col gap-6 items-start text-xs uppercase tracking-widest font-semibold text-white">
              {[
                { label: 'PRD Lengkap', icon: 'solar:document-add-linear' },
                { label: 'Prototype Brief', icon: 'solar:widget-linear' },
                { label: 'MOM / Notulen', icon: 'solar:notes-linear' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <iconify-icon icon={item.icon} width="16" />
                  {item.label}
                </div>
              ))}
            </div>
            <div className="w-56 h-56 flex items-center justify-center shrink-0">
              <img src="https://etalasaccounts.github.io/sandwich/public/spec-illustration.webp" alt="Spec" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
            <div className="flex flex-col gap-6 items-start text-xs uppercase tracking-widest font-semibold text-white">
              {[
                { label: 'Quotation Klien', icon: 'solar:dollar-minimalistic-linear' },
                { label: 'Format Brief Klien', icon: 'solar:letter-linear' },
                { label: 'Specs Fitur & Task', icon: 'solar:checklist-linear' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <iconify-icon icon={item.icon} width="16" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: FEATURES ── cream */}
      <section id="features" className="py-28" style={{ backgroundColor: '#F4EBE1' }}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
              Why it works
            </p>
            <h2 className="text-black leading-none" style={{ fontFamily: bowlby, fontSize: 'clamp(2.5rem, 6vw, 4rem)', letterSpacing: '-0.02em' }}>
              BUILT FOR THE<br />WAY AGENTS WORK
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-4 p-6 rounded-2xl bg-white shadow-sm border border-black/5 hover:-translate-y-1 transition-transform duration-200">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
                  <iconify-icon icon={f.icon} width="20" style={{ color: '#ffffff' }} />
                </div>
                <p className="font-semibold text-zinc-900 text-sm">{f.title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FEED YOUR PIPELINE ── black */}
      <section id="pipeline" className="py-28" style={{ backgroundColor: '#000000' }}>
        <div className="max-w-3xl mx-auto px-8">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
            Got a Spec?
          </p>
          <h2 className="text-white leading-none mb-8" style={{ fontFamily: bowlby, fontSize: 'clamp(3rem, 9vw, 6rem)', letterSpacing: '-0.02em' }}>
            FEED YOUR<br />PIPELINE.
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-xl mb-10">
            SANDWICH was built because there's always been a gap between what a client describes and what an agent can execute.
            The spec closes that gap. What you do with it next depends on your stack — but if you're looking for a starting point,
            we recommend{' '}
            <a href="https://superpowers.obra.studio" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-white/90 transition-colors">
              Superpowers by Obra
            </a>. It's what we reach for.
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold tracking-widest">
            <span className="text-white">SANDWICH</span>
            <span className="text-white/30">→</span>
            <span className="text-white/40">SUPERPOWERS</span>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: WHAT'S IN THE STACK ── cream */}
      <section id="stack" className="py-28" style={{ backgroundColor: '#F4EBE1' }}>
        <div className="max-w-6xl mx-auto px-8 flex flex-col items-center text-center">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
            Ingredients
          </p>
          <h2 className="text-black leading-none mb-4" style={{ fontFamily: bowlby, fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.02em' }}>
            WHAT'S IN THE STACK
          </h2>
          <p className="text-zinc-500 text-base max-w-md mb-20 leading-relaxed">
            Four layers, each with a job. Together they take raw client chaos and hand your agent a spec it can actually execute.
          </p>
          <div className="flex flex-row justify-center items-start gap-16 md:gap-24">
            {[
              { img: 'https://www.cravburgers.shop/img-webp/tomato.webp', label: '/ ORDER', desc: 'Structures the brief', offset: false },
              { img: 'https://www.cravburgers.shop/img-webp/cheese.webp', label: '/ PREP', desc: 'Scores impact', offset: true },
              { img: 'https://www.cravburgers.shop/img-webp/meat.webp', label: '/ RECIPE', desc: 'Writes the spec', offset: false },
              { img: 'https://www.cravburgers.shop/img-webp/lettuce.webp', label: '/ VALIDATE', desc: 'Checks confidence', offset: true },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center text-center w-36" style={{ transform: item.offset ? 'translateY(2rem)' : 'none' }}>
                <img src={item.img} alt={item.label} className="w-28 h-28 object-contain mb-6 drop-shadow-lg" />
                <p className="text-sm font-bold text-black tracking-tight mb-1">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: TESTIMONIALS ── yellow */}
      <section id="testimonials" className="py-28" style={{ backgroundColor: '#F9CD25' }}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ fontFamily: bowlby, color: 'rgba(0,0,0,0.4)' }}>
              What they say
            </p>
            <h2 className="text-black leading-none" style={{ fontFamily: bowlby, fontSize: 'clamp(2.5rem, 6vw, 4rem)', letterSpacing: '-0.02em' }}>
              TEAMS THAT SHIP FASTER
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="flex flex-col gap-4 p-7 rounded-2xl bg-white shadow-sm">
                <iconify-icon icon="solar:quote-up-bold" width="24" style={{ color: '#f91814' }} />
                <p className="text-sm text-zinc-700 leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                  <p className="text-xs text-zinc-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: PRICING ── black */}
      <section id="pricing" className="py-28" style={{ backgroundColor: '#000000' }}>
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
              Pricing
            </p>
            <h2 className="text-white leading-none mb-4" style={{ fontFamily: bowlby, fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.02em' }}>
              SIMPLE PRICING.<br />NO SURPRISES.
            </h2>
            <p className="text-white/50 text-base">Start free. Scale when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="relative flex flex-col rounded-2xl p-8 border transition-transform duration-200 hover:-translate-y-1"
                style={{
                  backgroundColor: plan.highlight ? '#f91814' : '#111111',
                  borderColor: plan.highlight ? '#f91814' : 'rgba(255,255,255,0.08)',
                }}
              >
                {plan.badge && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: '#F9CD25', color: '#000000' }}
                  >
                    {plan.badge}
                  </span>
                )}

                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#f91814', fontFamily: bowlby }}>
                  {plan.name}
                </p>
                <div className="mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white whitespace-nowrap" style={{ fontFamily: bowlby, fontSize: '2.8rem', lineHeight: 1 }}>{plan.price}</span>
                    <span className="text-sm whitespace-nowrap" style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>{plan.sub}</span>
                  </div>
                  {'oldPrice' in plan && plan.oldPrice && (
                    <span className="line-through" style={{ fontSize: '1.1rem', color: plan.highlight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)' }}>{plan.oldPrice}</span>
                  )}
                </div>
                <p className="text-sm mb-8" style={{ color: plan.highlight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>
                  {plan.desc}
                </p>

                <ul className="flex flex-col gap-3 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}>
                      <iconify-icon
                        icon="solar:check-circle-linear"
                        width="16"
                        style={{ color: plan.highlight ? '#ffffff' : '#f91814', marginTop: '1px', flexShrink: 0 }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: plan.highlight ? '#ffffff' : '#f91814',
                    color: plan.highlight ? '#f91814' : '#ffffff',
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Enterprise row */}
          <div
            className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6 p-10 rounded-2xl"
            style={{ backgroundColor: '#F4EBE1' }}
          >
            <div>
              <p className="font-bold text-lg mb-1" style={{ color: '#1a1a1a', fontFamily: bowlby, letterSpacing: '-0.01em' }}>ENTERPRISE</p>
              <p className="text-sm text-zinc-500">Custom seats, SLA, SSO, dedicated support, on-prem option. Let's talk.</p>
            </div>
            <a
              href="mailto:hello@etalas.studio"
              className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f91814' }}
            >
              Contact sales
              <iconify-icon icon="solar:arrow-right-linear" width="14" />
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: GOT QUESTIONS ── black */}
      <section id="faq" className="py-20" style={{ backgroundColor: '#000000', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-3xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#f91814', fontFamily: bowlby }}>
              Shout Out
            </p>
            <h2 className="text-white leading-none" style={{ fontFamily: bowlby, fontSize: 'clamp(3rem, 9vw, 6rem)', letterSpacing: '-0.02em' }}>
              GOT QUESTIONS?
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-zinc-800">
            {FAQS.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-white text-base">{faq.q}</span>
                  <iconify-icon
                    icon="solar:alt-arrow-down-linear"
                    width="18"
                    style={{ color: '#f91814', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
                  />
                </button>
                {openFaq === i && (
                  <p className="pb-5 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-16">
            <a
              href="https://www.etalas.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold text-white tracking-widest uppercase hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f91814' }}
            >
              Product by Etalas
              <iconify-icon icon="solar:arrow-right-up-linear" width="16" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="flex items-center justify-between px-8 py-5 border-t border-white/5"
        style={{ backgroundColor: '#000000' }}
      >
        <span className="text-xs text-white/25">© 2026 SANDWICH by Etalas</span>
        <div className="flex items-center gap-5">
          <a href="https://github.com/etalas-studio/sandwich-2" target="_blank" rel="noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
            <iconify-icon icon="simple-icons:github" width="12" />
            GitHub
          </a>
          <a href="https://www.etalas.com/" target="_blank" rel="noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Etalas
          </a>
          <a href="https://twitter.com/etalas_studio" target="_blank" rel="noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
            <iconify-icon icon="simple-icons:x" width="11" />
            Twitter
          </a>
        </div>
      </footer>
    </div>
  )
}
