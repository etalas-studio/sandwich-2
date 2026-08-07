import { useState, useRef, useCallback, useEffect } from 'react'
import { getTickets, saveTicket, deleteTicket, type LocalTicket, type TicketType } from '../lib/localTickets'
import { createTicket } from '../api/tickets'
import Settings from './Settings'

interface AttachedFile { name: string; type: string; dataUrl: string }

const bowlby = "'Bowlby One', system-ui"
const inter = "'Inter', sans-serif"

const NAV = [
  { label: 'Home', icon: 'solar:home-2-linear', id: 'home' },
  { section: 'BRIEF' },
  { label: 'My Briefs', icon: 'solar:notes-linear', id: 'briefs' },
  { label: 'Templates', icon: 'solar:document-text-linear', id: 'templates' },
  { section: 'PIPELINE' },
  { label: 'PRD', icon: 'solar:document-add-linear', id: 'prd' },
  { label: 'MOM / Notulen', icon: 'solar:calendar-linear', id: 'mom' },
  { label: 'Quotation', icon: 'solar:dollar-minimalistic-linear', id: 'quotation' },
  { label: 'Specs & Task', icon: 'solar:checklist-linear', id: 'specs' },
]

const CHIPS = [
  { label: 'PRD Lengkap',     type: 'prd'       as TicketType, icon: 'solar:document-add-linear',        prompt: 'Buatkan PRD lengkap untuk ' },
  { label: 'Prototype Brief', type: 'prototype'  as TicketType, icon: 'solar:widget-linear',              prompt: 'Buatkan prototype brief untuk ' },
  { label: 'MOM',             type: 'mom'        as TicketType, icon: 'solar:calendar-linear',            prompt: 'Buatkan MOM untuk ' },
  { label: 'Quotation',       type: 'quotation'  as TicketType, icon: 'solar:dollar-minimalistic-linear', prompt: 'Buatkan quotation untuk ' },
  { label: 'Specs & Task',    type: 'specs'      as TicketType, icon: 'solar:checklist-linear',           prompt: 'Buatkan specs dan task untuk ' },
]

const QUICK_TYPES = [
  { label: 'PRD Lengkap',          type: 'prd'       as TicketType, icon: 'solar:document-add-linear',        color: '#fef3c7', iconColor: '#f97316', prompt: 'Buatkan PRD lengkap untuk ' },
  { label: 'Prototype Brief',      type: 'prototype'  as TicketType, icon: 'solar:widget-linear',              color: '#ede9fe', iconColor: '#7c3aed', prompt: 'Buatkan prototype brief untuk ' },
  { label: 'Workflow Automations', type: 'workflow'   as TicketType, icon: 'solar:settings-minimalistic-linear', color: '#dbeafe', iconColor: '#2563eb', prompt: 'Buatkan workflow automation untuk ' },
  { label: 'MOM Meeting',          type: 'mom'        as TicketType, icon: 'solar:calendar-linear',            color: '#dcfce7', iconColor: '#16a34a', prompt: 'Buatkan MOM untuk ' },
  { label: 'Quotation Brief',      type: 'quotation'  as TicketType, icon: 'solar:dollar-minimalistic-linear', color: '#fce7f3', iconColor: '#db2777', prompt: 'Buatkan quotation untuk ' },
  { label: 'Specs & Task',         type: 'specs'      as TicketType, icon: 'solar:checklist-linear',           color: '#f0fdf4', iconColor: '#15803d', prompt: 'Buatkan specs dan task untuk ' },
]

const PIPELINE_MAP: Record<string, { type: TicketType; title: string; desc: string; prompt: string; chip: string }> = {
  prd:       { type: 'prd',       title: 'PRD',           desc: 'Product Requirements Documents',     prompt: 'Buatkan PRD lengkap untuk ',      chip: 'PRD Lengkap' },
  mom:       { type: 'mom',       title: 'MOM / Notulen', desc: 'Minutes of Meeting dan notulensi',   prompt: 'Buatkan MOM untuk ',              chip: 'MOM' },
  quotation: { type: 'quotation', title: 'Quotation',     desc: 'Estimasi dan kalkulasi proyek',      prompt: 'Buatkan quotation untuk ',        chip: 'Quotation' },
  specs:     { type: 'specs',     title: 'Specs & Task',  desc: 'Technical specs dan task breakdown', prompt: 'Buatkan specs dan task untuk ',   chip: 'Specs & Task' },
}

const TYPE_META: Record<string, { label: string; color: string; ic: string; icon: string }> = {
  prd:       { label: 'PRD',       color: '#fef3c7', ic: '#f97316', icon: 'solar:document-add-linear' },
  mom:       { label: 'MOM',       color: '#dbeafe', ic: '#2563eb', icon: 'solar:calendar-linear' },
  quotation: { label: 'Quotation', color: '#dcfce7', ic: '#16a34a', icon: 'solar:dollar-minimalistic-linear' },
  specs:     { label: 'Specs',     color: '#fce7f3', ic: '#db2777', icon: 'solar:checklist-linear' },
  prototype: { label: 'Prototype', color: '#ede9fe', ic: '#7c3aed', icon: 'solar:widget-linear' },
  workflow:  { label: 'Workflow',  color: '#dbeafe', ic: '#2563eb', icon: 'solar:settings-minimalistic-linear' },
  general:   { label: 'Brief',     color: 'rgba(255,255,255,0.1)', ic: 'rgba(255,255,255,0.5)', icon: 'solar:notes-linear' },
}

const STAGE_LABELS: Record<string, string> = {
  judge:      'Menganalisis brief...',
  implement:  'Membuat dokumen...',
  verify:     'Memverifikasi hasil...',
  open_pr:    'Membuka PR...',
}

// ── Chat View ─────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'ai'
  text?: string
  stage?: string        // for stage_start events
  isDone?: boolean
  isError?: boolean
  output?: string
  ticketId?: string
}

function usePipelineStream(ticketKey: string | null, onDone?: (output: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    if (!ticketKey) return
    setStreaming(true)

    // First trigger the run
    fetch(`/api/tickets/${ticketKey}/run`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    }).catch(() => {})

    // Then stream SSE
    const ctrl = new AbortController()
    fetch(`/api/tickets/${ticketKey}/stream`, { credentials: 'include', signal: ctrl.signal })
      .then(async res => {
        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim()
            if (!line) continue
            try {
              const ev = JSON.parse(line) as { type: string; stage?: string; ticket?: { status?: string; content?: string } }
              if (ev.type === 'stage_start' && ev.stage) {
                setMessages(m => [...m, { role: 'ai', stage: ev.stage }])
              } else if (ev.type === 'done' || ev.type === 'stage_end') {
                if (ev.type === 'done') {
                  const output = ev.ticket?.content ?? ''
                  setMessages(m => [...m, { role: 'ai', isDone: true, output }])
                  setStreaming(false)
                  onDone?.(output)
                }
              } else if (ev.type === 'error') {
                setMessages(m => [...m, { role: 'ai', isError: true, text: 'Terjadi error saat memproses brief.' }])
                setStreaming(false)
              }
            } catch { /* skip bad JSON */ }
          }
        }
      })
      .catch(() => setStreaming(false))

    return () => ctrl.abort()
  }, [ticketKey])

  return { messages, streaming }
}

function ChatView({
  initialPrompt,
  ticketKey,
  onNewPrompt,
  onBack,
}: {
  initialPrompt: string
  ticketKey: string
  onNewPrompt: (prompt: string) => void
  onBack: () => void
}) {
  const { messages, streaming } = usePipelineStream(ticketKey, () => {})
  const [followUp, setFollowUp] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  return (
    <div className="flex flex-col h-full">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0" style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(244,235,225,0.7)' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-60" style={{ color: 'rgba(0,0,0,0.4)' }}>
          <iconify-icon icon="solar:arrow-left-linear" width="14" />
          Kembali
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
        {/* User bubble */}
        <div className="flex justify-end">
          <div className="max-w-xl px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed" style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: inter }}>
            {initialPrompt}
          </div>
        </div>

        {/* AI messages */}
        {messages.map((m, i) => {
          if (m.stage) return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
                <span className="text-white text-[10px] font-black" style={{ fontFamily: bowlby }}>S</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)', color: '#374151' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f91814' }} />
                {STAGE_LABELS[m.stage] ?? m.stage}
              </div>
            </div>
          )
          if (m.isDone && m.output) return (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#f91814' }}>
                <span className="text-white text-[10px] font-black" style={{ fontFamily: bowlby }}>S</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', color: '#1a1a1a', fontFamily: inter }}>
                  {m.output}
                </div>
              </div>
            </div>
          )
          if (m.isError) return (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
                <span className="text-white text-[10px] font-black" style={{ fontFamily: bowlby }}>S</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                {m.text}
              </div>
            </div>
          )
          return null
        })}

        {/* Typing indicator */}
        {streaming && messages.every(m => !m.stage && !m.isDone && !m.isError) && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
              <span className="text-white text-[10px] font-black" style={{ fontFamily: bowlby }}>S</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Prompt follow-up box */}
      {!streaming && (
        <div className="shrink-0 px-6 py-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(244,235,225,0.7)' }}>
          <div className="max-w-2xl mx-auto flex items-end gap-3">
            <textarea
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && followUp.trim()) { onNewPrompt(followUp.trim()); setFollowUp('') } }}
              placeholder="Lanjut tanya atau buat brief baru..."
              rows={1}
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: '#111113', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', minHeight: '44px', maxHeight: '120px', fontFamily: inter }}
            />
            <button
              onClick={() => { if (followUp.trim()) { onNewPrompt(followUp.trim()); setFollowUp('') } }}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{ backgroundColor: '#f91814' }}
            >
              <iconify-icon icon="solar:arrow-up-linear" width="15" style={{ color: '#ffffff' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Auto-login with guest credentials so API session works
async function ensureSession(): Promise<void> {
  try {
    const check = await fetch('/api/auth/me', { credentials: 'include' })
    if (check.ok) return
    await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'sandwich', password: 'sandwich' }),
    })
  } catch { /* ignore */ }
}

// ── Prompt Box (reusable) ──────────────────────────────────────────────────────
interface PromptBoxProps {
  defaultType?: TicketType
  onSuccess: (t: LocalTicket) => void
  compact?: boolean
}
function PromptBox({ defaultType = 'general', onSuccess, compact = false }: PromptBoxProps) {
  const [prompt, setPrompt] = useState('')
  const [activeType, setActiveType] = useState<TicketType>(defaultType)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setActiveType(defaultType) }, [defaultType])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => setAttachments(p => [...p, { name: file.name, type: file.type, dataUrl: reader.result as string }])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [])

  const handleSubmit = async () => {
    if (!prompt.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      await ensureSession()
      const desc = attachments.length
        ? attachments.map(a => `[attachment: ${a.name}]`).join('\n')
        : prompt.trim()
      const ticket = await createTicket({ id: '', summary: prompt.trim(), description: desc, url: '' })
      const local: LocalTicket = {
        id: ticket.key,
        summary: ticket.summary ?? prompt.trim(),
        description: desc,
        createdAt: ticket.createdAt,
        type: activeType,
        status: 'processing',
      }
      saveTicket(local)
      setPrompt('')
      setAttachments([])
      onSuccess(local)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-2xl" style={{ backgroundColor: '#111113' }}>
      {/* chips */}
      {!compact && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CHIPS.map(c => (
            <button key={c.label}
              onClick={() => { setActiveType(c.type); setPrompt(p => p || c.prompt) }}
              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              style={activeType === c.type
                ? { backgroundColor: '#f91814', color: '#ffffff', border: '1px solid #f91814' }
                : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }
              }>
              <iconify-icon icon={c.icon} width="12" />
              {c.label}
            </button>
          ))}
        </div>
      )}
      {compact && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#f91814', color: '#ffffff' }}>
            <iconify-icon icon={TYPE_META[activeType]?.icon ?? 'solar:notes-linear'} width="11" />
            {TYPE_META[activeType]?.label ?? 'Brief'}
          </div>
        </div>
      )}

      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSubmit() } }}
        placeholder={compact ? `Deskripsikan ${TYPE_META[activeType]?.label ?? 'brief'} kamu...` : 'Ceritain brief lo di sini...'}
        rows={compact ? 2 : 3}
        className="w-full resize-none bg-transparent text-sm outline-none px-4 py-3 leading-relaxed text-white placeholder:text-white/30"
        style={{ minHeight: compact ? '56px' : '72px' }}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
              {a.type.startsWith('image/') ? <img src={a.dataUrl} className="w-4 h-4 rounded object-cover" alt="" /> : <iconify-icon icon="solar:document-linear" width="12" />}
              <span className="max-w-[100px] truncate">{a.name}</span>
              <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="opacity-40 hover:opacity-100">
                <iconify-icon icon="solar:close-circle-bold" width="12" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-4 pb-2 text-xs" style={{ color: '#f91814' }}>{error}</p>}

      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <div className="flex items-center gap-1">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
          <button onClick={() => imageInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <iconify-icon icon="solar:gallery-linear" width="15" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <iconify-icon icon="solar:paperclip-linear" width="15" />
          </button>
          <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>⌘↵</span>
        </div>
        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !prompt.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
          style={{ backgroundColor: '#f91814' }}
        >
          <iconify-icon icon={isSubmitting ? 'solar:refresh-linear' : 'solar:arrow-up-linear'} width="15" style={{ color: '#ffffff' }} />
        </button>
      </div>
    </div>
  )
}

// ── Ticket List ────────────────────────────────────────────────────────────────
function TicketList({ tickets, onOpen, onNew }: { tickets: LocalTicket[]; onOpen: (t: LocalTicket) => void; onNew: () => void }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border" style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
          <iconify-icon icon="solar:notes-linear" width="22" style={{ color: 'rgba(0,0,0,0.3)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: '#374151' }}>Belum ada dokumen</p>
        <p className="text-xs mt-1 mb-5" style={{ color: '#9ca3af' }}>Buat yang pertama dari form di atas</p>
        <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#f91814', color: '#ffffff' }}>
          <iconify-icon icon="solar:add-linear" width="14" />
          Buat Brief
        </button>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
      {tickets.map(t => {
        const meta = TYPE_META[t.type] ?? TYPE_META.general
        return (
          <button key={t.id} onClick={() => onOpen(t)}
            className="w-full flex items-center justify-between px-5 py-4 text-left border-b last:border-b-0 transition-colors"
            style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                <iconify-icon icon={meta.icon} width="15" style={{ color: meta.ic }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{t.summary}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  {new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                backgroundColor: t.status === 'done' ? '#dcfce7' : '#f3f4f6',
                color: t.status === 'done' ? '#16a34a' : '#9ca3af'
              }}>{t.status === 'done' ? 'Done' : t.status === 'processing' ? 'Diproses' : 'Draft'}</span>
              <iconify-icon icon="solar:arrow-right-linear" width="14" style={{ color: '#d1d5db' }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
function Drawer({ ticket, onClose, onDelete }: { ticket: LocalTicket; onClose: () => void; onDelete: (id: string) => void }) {
  const meta = TYPE_META[ticket.type] ?? TYPE_META.general
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col shadow-2xl border-l"
        style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', fontFamily: inter }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.color }}>
              <iconify-icon icon={meta.icon} width="14" style={{ color: meta.ic }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>{meta.label}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              backgroundColor: ticket.status === 'done' ? '#dcfce7' : ticket.status === 'processing' ? '#fef3c7' : '#f3f4f6',
              color: ticket.status === 'done' ? '#16a34a' : ticket.status === 'processing' ? '#f97316' : '#6b7280'
            }}>
              {ticket.status === 'done' ? 'Selesai' : ticket.status === 'processing' ? 'Diproses' : 'Draft'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <iconify-icon icon="solar:close-linear" width="16" style={{ color: '#6b7280' }} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4 flex-1">
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {new Date(ticket.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <h2 className="text-base font-semibold leading-snug" style={{ color: '#111827' }}>{ticket.summary}</h2>
          {ticket.content ? (
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9ca3af' }}>Output</p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4" style={{ backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}>
                {ticket.content}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs py-3 px-4 rounded-xl" style={{ backgroundColor: '#f9fafb', color: '#9ca3af' }}>
              <iconify-icon icon="solar:hourglass-linear" width="14" />
              Brief dalam antrian — output akan muncul di sini
            </div>
          )}
          {ticket.description && (
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{ticket.description}</p>
          )}
          <p className="text-xs font-mono" style={{ color: '#d1d5db' }}>ID: {ticket.id}</p>
        </div>
        <div className="px-6 pb-6 flex gap-2 shrink-0">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-50"
              style={{ color: '#ef4444', border: '1px solid #fee2e2' }}>
              <iconify-icon icon="solar:trash-bin-trash-linear" width="14" />
              Hapus
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6b7280' }}>Yakin hapus?</span>
              <button onClick={() => { onDelete(ticket.id); onClose() }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: '#ef4444' }}>Hapus</button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100"
                style={{ color: '#6b7280' }}>Batal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ tickets, onOpen }: { tickets: LocalTicket[]; onOpen: (t: LocalTicket) => void }) {
  const total = tickets.length
  const processing = tickets.filter(t => t.status === 'processing').length
  const done = tickets.filter(t => t.status === 'done').length

  const byType = Object.entries(PIPELINE_MAP).map(([key, meta]) => ({
    ...meta,
    key,
    count: tickets.filter(t => t.type === meta.type).length,
    meta: TYPE_META[key],
  }))

  const recent = tickets.slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Brief', value: total, icon: 'solar:notes-linear', color: '#f4ebe1', ic: '#374151' },
          { label: 'Diproses', value: processing, icon: 'solar:hourglass-linear', color: '#fef3c7', ic: '#f97316' },
          { label: 'Selesai', value: done, icon: 'solar:check-circle-linear', color: '#dcfce7', ic: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 border flex flex-col gap-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color }}>
              <iconify-icon icon={s.icon} width="18" style={{ color: s.ic }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#111827', fontFamily: bowlby }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* By type */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Per Pipeline</p>
        <div className="grid grid-cols-2 gap-3">
          {byType.map(t => (
            <div key={t.key} className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(0,0,0,0.08)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: t.meta.color }}>
                <iconify-icon icon={t.meta.icon} width="15" style={{ color: t.meta.ic }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#111827' }}>{t.title}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{t.count} dokumen</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold" style={{ color: '#111827', fontFamily: bowlby }}>{t.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Brief Terbaru</p>
          <TicketList tickets={recent} onOpen={onOpen} onNew={() => {}} />
        </div>
      )}

      {total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border"
          style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
          <iconify-icon icon="solar:chart-linear" width="32" style={{ color: 'rgba(0,0,0,0.2)', marginBottom: '12px' }} />
          <p className="text-sm font-medium" style={{ color: '#374151' }}>Belum ada data</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Buat brief pertama untuk melihat overview</p>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Dashboard({ onBack }: { onBack: () => void }) {
  const [tickets, setTickets] = useState<LocalTicket[]>(() => getTickets())
  const [selected, setSelected] = useState<LocalTicket | null>(null)
  const [activeNav, setActiveNav] = useState('home')
  const [activeTab, setActiveTab] = useState<'chat' | 'overview'>('chat')
  const [chatState, setChatState] = useState<{ prompt: string; ticketKey: string } | null>(null)

  const refresh = () => setTickets(getTickets())

  const handleSuccess = (t: LocalTicket) => {
    refresh()
    setChatState({ prompt: t.summary, ticketKey: t.id })
  }

  const handleDelete = (id: string) => {
    deleteTicket(id)
    refresh()
    setSelected(null)
  }

  const byType = (type: TicketType) => tickets.filter(t => t.type === type)
  const isHomePage = activeNav === 'home'

  const renderPage = () => {
    if (activeNav === 'settings') return <Settings />

    if (activeNav === 'briefs') return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>MY BRIEFS</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{tickets.length} dokumen tersimpan</p>
          </div>
          <TicketList tickets={tickets} onOpen={setSelected} onNew={() => setActiveNav('home')} />
        </div>
      </div>
    )

    if (activeNav === 'templates') return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>TEMPLATES</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>Pilih template, langsung buat brief</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_TYPES.map(t => (
              <button key={t.label}
                onClick={() => { setActiveNav(t.type === 'workflow' ? 'home' : t.type); }}
                className="flex items-start gap-4 p-5 rounded-2xl border text-left transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(0,0,0,0.08)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)')}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.color }}>
                  <iconify-icon icon={t.icon} width="18" style={{ color: t.iconColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>{t.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Klik untuk mulai →</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )

    const pp = PIPELINE_MAP[activeNav]
    if (!pp) return null
    const filtered = byType(pp.type)

    return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div>
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>{pp.title.toUpperCase()}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{pp.desc} · {filtered.length} dokumen</p>
          </div>

          {/* Prompt box inline */}
          <PromptBox defaultType={pp.type} onSuccess={handleSuccess} compact={true} />

          {/* List */}
          <TicketList tickets={filtered} onOpen={setSelected} onNew={() => {}} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F4EBE1', fontFamily: inter }}>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col w-56 shrink-0" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
              <span className="text-white font-black text-xs" style={{ fontFamily: bowlby }}>S</span>
            </div>
            <span className="font-bold text-sm tracking-wide text-white" style={{ fontFamily: bowlby }}>SANDWICH</span>
          </div>
          <button className="p-1 rounded transition-colors hover:bg-white/10">
            <iconify-icon icon="solar:sidebar-minimalistic-linear" width="15" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <iconify-icon icon="solar:magnifer-linear" width="13" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Search...</span>
            <span className="text-[10px] font-mono px-1 rounded" style={{ color: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' }}>⌘K</span>
          </div>
        </div>

        <nav className="flex-1 px-2 overflow-y-auto">
          {NAV.map((item, i) => {
            if ('section' in item) return (
              <p key={i} className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>{item.section}</p>
            )
            const isActive = activeNav === item.id
            const pipelineType = PIPELINE_MAP[item.id!]?.type
            const count = pipelineType ? byType(pipelineType).length : 0
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id!)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left mb-0.5"
                style={isActive
                  ? { backgroundColor: '#f91814', color: '#ffffff', fontWeight: 500 }
                  : { color: 'rgba(255,255,255,0.5)' }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
              >
                <iconify-icon icon={item.icon} width="15" />
                {item.label}
                {count > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t px-2 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-0.5 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <iconify-icon icon="solar:question-circle-linear" width="15" />
            Help &amp; Docs
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-2 transition-colors"
            style={{ color: activeNav === 'settings' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', backgroundColor: activeNav === 'settings' ? 'rgba(255,255,255,0.08)' : '' }}
            onClick={() => setActiveNav('settings')}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = activeNav === 'settings' ? 'rgba(255,255,255,0.08)' : '')}>
            <iconify-icon icon="solar:settings-linear" width="15" />
            Settings
          </button>
          <button onClick={onBack} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#f91814' }}>S</div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium truncate text-white">Sandwich</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>← Kembali</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <div className="flex items-center justify-end px-6 py-3 border-b shrink-0" style={{ backgroundColor: 'rgba(244,235,225,0.8)', borderColor: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:lightning-bold" width="12" />
              Upgrade ke PRO
            </button>
            <button className="p-2 rounded-lg hover:bg-black/5 transition-colors">
              <iconify-icon icon="solar:bell-linear" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
            </button>
            <button className="p-2 rounded-lg hover:bg-black/5 transition-colors">
              <iconify-icon icon="solar:upload-linear" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
            </button>
            <button className="p-2 rounded-lg hover:bg-black/5 transition-colors">
              <iconify-icon icon="solar:menu-dots-bold" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
            </button>
          </div>
        </div>

        {/* Tab bar — only on home */}
        {isHomePage && (
          <div className="flex items-center gap-1 px-6 py-3 border-b shrink-0" style={{ backgroundColor: 'rgba(244,235,225,0.6)', borderColor: 'rgba(0,0,0,0.08)' }}>
            <button onClick={() => setActiveTab('chat')}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={activeTab === 'chat' ? { backgroundColor: '#0a0a0a', color: '#ffffff' } : { color: 'rgba(0,0,0,0.4)' }}>
              Brief Mode
            </button>
            <button onClick={() => setActiveTab('overview')}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={activeTab === 'overview' ? { backgroundColor: '#0a0a0a', color: '#ffffff' } : { color: 'rgba(0,0,0,0.4)' }}>
              Overview
            </button>
            {tickets.length > 0 && (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium" style={{ borderColor: '#bbf7d0', color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#22c55e' }} />
                {tickets.length} Brief
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {chatState ? (
          <div className="flex-1 min-h-0">
            <ChatView
              initialPrompt={chatState.prompt}
              ticketKey={chatState.ticketKey}
              onBack={() => setChatState(null)}
              onNewPrompt={(p) => {
                setChatState(null)
                // small delay so PromptBox re-mounts with fresh state
                setTimeout(() => {
                  const ev = new CustomEvent('sandwich:inject-prompt', { detail: p })
                  window.dispatchEvent(ev)
                }, 50)
              }}
            />
          </div>
        ) : isHomePage ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-10">
            {activeTab === 'overview' ? (
              <div className="w-full max-w-2xl">
                <div className="mb-6">
                  <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>OVERVIEW</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>Ringkasan semua brief kamu</p>
                </div>
                <OverviewTab tickets={tickets} onOpen={setSelected} />
              </div>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl text-center mb-8 tracking-tighter" style={{ color: '#111827', fontFamily: bowlby, maxWidth: '560px' }}>
                  BRIEF APA YANG MAU DIKERJAKAN?
                </h1>
                <div className="w-full max-w-2xl mb-8">
                  <PromptBox onSuccess={handleSuccess} />
                </div>
                <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-10">
                  {QUICK_TYPES.map(qt => (
                    <button key={qt.label} onClick={() => setActiveNav(qt.type === 'workflow' ? 'home' : qt.type)}
                      className="flex flex-col items-start p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(0,0,0,0.08)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.6)')}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: qt.color }}>
                        <iconify-icon icon={qt.icon} width="18" style={{ color: qt.iconColor }} />
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>{qt.label}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>Buat brief →</p>
                    </button>
                  ))}
                </div>
                {tickets.length > 0 && (
                  <div className="w-full max-w-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <iconify-icon icon="solar:history-linear" width="14" style={{ color: 'rgba(0,0,0,0.3)' }} />
                        <p className="text-sm font-semibold" style={{ color: '#374151' }}>Brief Terbaru</p>
                      </div>
                      <button onClick={() => setActiveNav('briefs')} className="text-xs" style={{ color: '#9ca3af' }}>Lihat semua →</button>
                    </div>
                    <TicketList tickets={tickets.slice(0, 5)} onOpen={setSelected} onNew={() => {}} />
                  </div>
                )}
              </>
            )}
          </div>
        ) : renderPage()}
      </main>


      {selected && <Drawer ticket={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}
    </div>
  )
}
