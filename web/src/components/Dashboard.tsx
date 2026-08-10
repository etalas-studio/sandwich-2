import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getTickets, saveTicket, updateTicket, deleteTicket, type LocalTicket, type TicketType } from '../lib/localTickets'
import { createTicket, updateTicket as updateTicketApi } from '../api/tickets'
import Settings from './Settings'
import HelpPage from './HelpPage'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import { ensureSession } from '../lib/session'
import { randomPrompt, type PromptChipType } from '../lib/promptTemplates'
import { CHIPS } from '../lib/promptChips'
import { useLanguage, type StringKey } from '../lib/i18n'
import ModelSelector from './ModelSelector'

interface AttachedFile { name: string; type: string; dataUrl: string }

const bowlby = "'Bowlby One', system-ui"
const inter = "'Inter', sans-serif"

const NAV = [
  { label: 'Prototype', icon: 'solar:widget-linear', id: 'prototype' },
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
  prototype: { type: 'prototype', title: 'Prototype',     desc: 'Prototype brief dan UI flow',        prompt: 'Buatkan prototype brief untuk ',  chip: 'Prototype' },
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

const STAGE_LABEL_KEYS: Record<string, StringKey> = {
  judge:      'stage_judge',
  implement:  'stage_implement',
  verify:     'stage_verify',
  open_pr:    'stage_open_pr',
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

function usePipelineStream(ticketKey: string | null, regenNonce: number, autoRun: boolean, onDone?: (output: string) => void) {
  const { t: tr } = useLanguage()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    if (!ticketKey) return
    // Don't auto-generate when opening existing ticket from history (regenNonce=0 and autoRun=false)
    if (!autoRun && regenNonce === 0) return
    setMessages([])
    setStreaming(true)

    // Open SSE stream first, then trigger generate — avoids race where stream
    // sees inFlight empty and closes immediately
    const ctrl = new AbortController()
    const streamPromise = fetch(`/api/tickets/${ticketKey}/stream`, { credentials: 'include', signal: ctrl.signal })

    // Small delay so stream connection is registered before generate fires
    setTimeout(() => {
      fetch(`/api/tickets/${ticketKey}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      }).catch(() => {})
    }, 200)

    streamPromise
      .then(async res => {
        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) { setStreaming(false); break }
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim()
            if (!line) continue
            try {
              const ev = JSON.parse(line) as { type: string; stage?: string; ticket?: { prDescription?: string } }
              if (ev.type === 'stage_start' && ev.stage) {
                setMessages(m => [...m, { role: 'ai', stage: ev.stage }])
              } else if (ev.type === 'done') {
                const output = ev.ticket?.prDescription ?? ''
                setMessages(m => [...m, { role: 'ai', isDone: true, output }])
                setStreaming(false)
                onDone?.(output)
              } else if (ev.type === 'error') {
                setMessages(m => [...m, { role: 'ai', isError: true, text: tr('pipeline_error') }])
                setStreaming(false)
              }
            } catch { /* skip bad JSON */ }
          }
        }
      })
      .catch(() => setStreaming(false))

    return () => ctrl.abort()
  }, [ticketKey, regenNonce])

  return { messages, streaming }
}

function timeAgo(iso: string, t: (key: StringKey) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t('dash_time_just_now')
  if (mins < 60) return `${mins} ${t('dash_time_minutes_ago')}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ${t('dash_time_hours_ago')}`
  const days = Math.floor(hours / 24)
  return `${days} ${t('dash_time_days_ago')}`
}

const PLAN_BENEFITS: Record<string, { icon: string; text: string }[]> = {
  starter: [
    { icon: 'solar:document-add-linear', text: '5 PRDs / month' },
    { icon: 'solar:chat-round-linear', text: 'AI chat 100x / month' },
    { icon: 'solar:download-minimalistic-linear', text: 'Download Markdown' },
    { icon: 'solar:checklist-linear', text: 'Generate specs & tasks' },
  ],
  pro: [
    { icon: 'solar:document-add-linear', text: 'Unlimited PRDs' },
    { icon: 'solar:chat-round-linear', text: 'Unlimited AI chat' },
    { icon: 'solar:download-minimalistic-linear', text: 'Download Markdown' },
    { icon: 'solar:checklist-linear', text: 'Generate specs & tasks' },
    { icon: 'solar:crown-linear', text: 'Premium AI model' },
    { icon: 'solar:user-speak-linear', text: 'Direct chat with Raf Dev' },
  ],
}

function PlanBadge() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const plan = localStorage.getItem('sandwich_paid_plan')
  if (!plan) return null
  const isPro = plan === 'pro'
  const benefits = PLAN_BENEFITS[plan] ?? PLAN_BENEFITS.starter

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: isPro ? '#f91814' : '#111827' }}
      >
        <iconify-icon icon={isPro ? 'solar:crown-bold' : 'solar:lightning-bold'} width="12" />
        <span className="hidden sm:inline">{isPro ? 'Pro' : 'Starter'}</span>
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 rounded-2xl p-4 z-50 w-56"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: isPro ? '#f91814' : 'rgba(255,255,255,0.1)' }}>
              <iconify-icon icon={isPro ? 'solar:crown-bold' : 'solar:lightning-bold'} width="12" style={{ color: '#fff' }} />
            </div>
            <span className="text-sm font-semibold text-white">{isPro ? 'Pro' : 'Starter'}</span>
          </div>
          <div className="flex flex-col gap-2">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <iconify-icon icon={b.icon} width="13" style={{ color: isPro ? '#f91814' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{b.text}</span>
              </div>
            ))}
          </div>
          {!isPro && (
            <button
              type="button"
              className="w-full mt-4 py-2 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: '#f91814' }}
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ChatView({
  initialPrompt,
  ticketKey,
  createdAt,
  autoRun,
  onPromptUpdate,
}: {
  initialPrompt: string
  ticketKey: string
  createdAt: string
  autoRun: boolean
  onPromptUpdate: (text: string) => void
}) {
  const { t: tr } = useLanguage()
  const [regenNonce, setRegenNonce] = useState(0)
  const { messages, streaming } = usePipelineStream(ticketKey, regenNonce, autoRun, () => {})
  const [followUp, setFollowUp] = useState('')
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [editValue, setEditValue] = useState(initialPrompt)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => setAttachments(p => [...p, { name: file.name, type: file.type, dataUrl: reader.result as string }])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])
  useEffect(() => { if (!editingPrompt) setEditValue(initialPrompt) }, [initialPrompt, editingPrompt])

  const handleRefreshResponse = () => {
    if (streaming) return
    setRegenNonce(n => n + 1)
  }

  const handleStartEdit = () => {
    setEditValue(initialPrompt)
    setEditingPrompt(true)
  }

  const handleSaveEdit = () => {
    const text = editValue.trim()
    setEditingPrompt(false)
    if (!text || text === initialPrompt) return
    onPromptUpdate(text)
    updateTicketApi(ticketKey, { summary: text, description: text }).catch(() => {})
    setRegenNonce(n => n + 1)
  }

  const handleCopyPrompt = () => {
    void navigator.clipboard.writeText(initialPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSend = () => {
    if (!followUp.trim() || streaming) return
    const attachmentTags = attachments.map(a => `[attachment: ${a.name}]`).join('\n')
    const text = attachmentTags ? `${followUp.trim()}\n${attachmentTags}` : followUp.trim()
    setFollowUp('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onPromptUpdate(text)
    updateTicketApi(ticketKey, { summary: text, description: text }).catch(() => {})
    setRegenNonce(n => n + 1)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#f4ebe1', fontFamily: inter }}>
      {/* Thread */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

          {/* User message — right bubble */}
          <div className="flex justify-end">
            <div className="max-w-[75%] flex flex-col items-end gap-1.5 group">
              {editingPrompt ? (
                <div className="w-full rounded-2xl px-4 py-3" style={{ backgroundColor: '#1a1a1a' }}>
                  <textarea
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSaveEdit() }
                      if (e.key === 'Escape') setEditingPrompt(false)
                    }}
                    rows={Math.min(10, editValue.split('\n').length + 1)}
                    className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
                    style={{ color: '#ffffff' }}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button onClick={() => setEditingPrompt(false)} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveEdit} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors" style={{ backgroundColor: '#f91814' }}>
                      {tr('dash_save_resend')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 rounded-2xl text-sm leading-relaxed" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                  {initialPrompt}
                </div>
              )}
              {!editingPrompt && (
                <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{timeAgo(createdAt, tr)}</span>
                  <button onClick={handleRefreshResponse} disabled={streaming}
                    className="p-1 rounded-md hover:bg-black/5 transition-colors disabled:opacity-30" title="Refresh respond">
                    <iconify-icon icon="solar:refresh-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                  </button>
                  <button onClick={handleStartEdit} className="p-1 rounded-md hover:bg-black/5 transition-colors" title="Edit">
                    <iconify-icon icon="solar:pen-2-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                  </button>
                  <button onClick={handleCopyPrompt} className="p-1 rounded-md hover:bg-black/5 transition-colors" title="Copy">
                    <iconify-icon icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI messages */}
          {messages.map((m, i) => {
            if (m.stage) return (
              <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: '#f91814' }} />
                {m.stage in STAGE_LABEL_KEYS ? tr(STAGE_LABEL_KEYS[m.stage]) : m.stage}
              </div>
            )
            if (m.isDone && m.output) return (
              <div key={i} className="text-sm whitespace-pre-wrap break-words" style={{ color: 'rgba(0,0,0,0.8)', lineHeight: '1.85' }}>
                {m.output}
              </div>
            )
            if (m.isError) return (
              <div key={i} className="text-sm" style={{ color: '#f87171' }}>{m.text}</div>
            )
            return null
          })}

          {/* Typing dots */}
          {streaming && messages.every(m => !m.stage && !m.isDone && !m.isError) && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(255,255,255,0.3)', animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(255,255,255,0.3)', animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(255,255,255,0.3)', animationDelay: '300ms' }} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — Claude style floating */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <div className="max-w-3xl mx-auto rounded-2xl" style={{ backgroundColor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)' }}>
          <textarea
            ref={textareaRef}
            value={followUp}
            onChange={e => {
              setFollowUp(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() } }}
            placeholder="Write a message..."
            rows={2}
            disabled={streaming}
            className="w-full resize-none bg-transparent outline-none px-5 pt-5 pb-2"
            style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', minHeight: '70px', maxHeight: '180px', lineHeight: '1.6' }}
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

          <div className="flex items-center gap-1 px-4 pb-4 pt-1">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
            <button onClick={() => imageInputRef.current?.click()} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
              <iconify-icon icon="solar:gallery-linear" width="18" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
              <iconify-icon icon="solar:paperclip-linear" width="18" />
            </button>
            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>⌘↵</span>
            <div className="flex-1" />
            <ModelSelector scope="chat" />
            <button
              onClick={handleSend}
              disabled={streaming || !followUp.trim()}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 active:scale-95 ml-2"
              style={{ backgroundColor: '#f91814' }}
            >
              <iconify-icon icon="solar:arrow-up-linear" width="14" style={{ color: '#ffffff' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Plan limit helper ─────────────────────────────────────────────────────────
function getPlanInfo() {
  const plan = localStorage.getItem('sandwich_paid_plan') ?? 'starter'
  const isPro = plan === 'pro'
  const limit = isPro ? Infinity : 5
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${now.getMonth()}`
  const used = getTickets().filter(t => {
    const d = new Date(t.createdAt)
    return `${d.getFullYear()}-${d.getMonth()}` === thisMonth
  }).length
  return { isPro, limit, used, remaining: Math.max(0, limit - used) }
}

// ── Prompt Box (reusable) ──────────────────────────────────────────────────────
interface PromptBoxProps {
  defaultType?: TicketType
  onSuccess: (t: LocalTicket) => void
}
function PromptBox({ defaultType = 'general', onSuccess }: PromptBoxProps) {
  const { t: tr } = useLanguage()
  const [prompt, setPrompt] = useState('')
  const [activeType, setActiveType] = useState<TicketType>(defaultType)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [planInfo, setPlanInfo] = useState(getPlanInfo)
  const atLimit = !planInfo.isPro && planInfo.used >= planInfo.limit

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
    if (atLimit) return
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
      setPlanInfo(getPlanInfo())
      onSuccess(local)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('dash_generic_error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-2xl" style={{ backgroundColor: '#111113' }}>
      {atLimit && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-t-2xl" style={{ backgroundColor: 'rgba(249,24,20,0.12)', borderBottom: '1px solid rgba(249,24,20,0.2)' }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#f91814' }}>{tr('plan_limit_title')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{tr('plan_limit_desc')}</p>
          </div>
          <a href="/checkout?plan=pro" className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ backgroundColor: '#f91814' }}>
            {tr('plan_limit_upgrade')}
          </a>
        </div>
      )}
      {defaultType === 'general' && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CHIPS.map(c => (
            <button key={c.labelKey}
              onClick={() => { setActiveType(c.type); setPrompt(randomPrompt(c.type as PromptChipType)) }}
              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              style={activeType === c.type
                ? { backgroundColor: '#f91814', color: '#ffffff', border: '1px solid #f91814' }
                : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }
              }>
              <iconify-icon icon={c.icon} width="12" />
              {tr(c.labelKey)}
            </button>
          ))}
          {!planInfo.isPro && !atLimit && (
            <span className="ml-auto shrink-0 text-[11px] pl-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{planInfo.used}/{planInfo.limit} this month</span>
          )}
        </div>
      )}

      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (!atLimit && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSubmit() } }}
        placeholder="Write a message..."
        rows={3}
        disabled={atLimit}
        className="w-full resize-none bg-transparent text-sm outline-none px-4 py-3 leading-relaxed text-white placeholder:text-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ minHeight: '72px' }}
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
          <button onClick={() => imageInputRef.current?.click()} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <iconify-icon icon="solar:gallery-linear" width="18" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <iconify-icon icon="solar:paperclip-linear" width="18" />
          </button>
          <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>⌘↵</span>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector scope="prompt" />
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !prompt.trim() || atLimit}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
            style={{ backgroundColor: '#f91814' }}
          >
            <iconify-icon icon={isSubmitting ? 'solar:refresh-linear' : 'solar:arrow-up-linear'} width="15" style={{ color: '#ffffff' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Artifact Grid (prototype cards) ─────────────────────────────────────────────
function ArtifactGrid({
  title,
  items,
  onOpen,
  onNew,
}: {
  title: string
  items: LocalTicket[]
  onOpen: (t: LocalTicket) => void
  onNew: () => void
}) {
  const { t: tr } = useLanguage()
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>{title.toUpperCase()}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{items.length} {tr('dash_prototypes_saved')}</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f91814', color: '#ffffff' }}
          >
            <iconify-icon icon="solar:add-circle-linear" width="15" />
            {tr('dash_new_prototype')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.slice().reverse().map(t => {
            const meta = TYPE_META[t.type] ?? TYPE_META.general
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="flex flex-col rounded-2xl overflow-hidden text-left border transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
              >
                <div className="h-28 flex items-center justify-center" style={{ backgroundColor: meta.color }}>
                  <iconify-icon icon={meta.icon} width="28" style={{ color: meta.ic }} />
                </div>
                <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{t.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                      backgroundColor: t.status === 'done' ? '#dcfce7' : '#f3f4f6',
                      color: t.status === 'done' ? '#16a34a' : '#9ca3af',
                    }}>{t.status === 'done' ? 'Done' : t.status === 'processing' ? tr('dash_status_processing') : 'Draft'}</span>
                    <span className="text-[11px]" style={{ color: '#9ca3af' }}>{timeAgo(t.createdAt, tr)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Ticket List ────────────────────────────────────────────────────────────────
function TicketList({ tickets, onOpen, onNew }: { tickets: LocalTicket[]; onOpen: (t: LocalTicket) => void; onNew: () => void }) {
  const { lang, t: tr } = useLanguage()
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border" style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
          <iconify-icon icon="solar:notes-linear" width="22" style={{ color: 'rgba(0,0,0,0.3)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: '#374151' }}>{tr('dash_no_docs')}</p>
        <p className="text-xs mt-1 mb-5" style={{ color: '#9ca3af' }}>{tr('dash_no_docs_sub')}</p>
        <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#f91814', color: '#ffffff' }}>
          <iconify-icon icon="solar:add-linear" width="14" />
          {tr('dash_create_brief')}
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
                  {new Date(t.createdAt).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                backgroundColor: t.status === 'done' ? '#dcfce7' : '#f3f4f6',
                color: t.status === 'done' ? '#16a34a' : '#9ca3af'
              }}>{t.status === 'done' ? 'Done' : t.status === 'processing' ? tr('dash_status_processing') : 'Draft'}</span>
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
// ── Main ───────────────────────────────────────────────────────────────────────
export default function Dashboard({ onBack: _onBack }: { onBack: () => void }) {
  const { t: tr } = useLanguage()
  const [tickets, setTickets] = useState<LocalTicket[]>(() => getTickets())
  const [selected, setSelected] = useState<LocalTicket | null>(null)
  const [activeNav, setActiveNav] = useState('home')

  const [chatState, setChatState] = useState<{ prompt: string; ticketKey: string; autoRun: boolean } | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareVisibility, setShareVisibility] = useState<'private' | 'shared'>('private')
  const { logout, state: authState } = useAuth()
  const username = authState.status === 'authenticated' ? authState.username : 'sandwich'
  const email = authState.status === 'authenticated' ? (authState as { email?: string }).email ?? username : username

  const refresh = () => setTickets(getTickets())

  const handleSuccess = (t: LocalTicket) => {
    refresh()
    setChatState({ prompt: t.summary, ticketKey: t.id, autoRun: true })
    setCreatingNew(false)
  }

  const handleDelete = (id: string) => {
    deleteTicket(id)
    refresh()
    setSelected(null)
  }

  const currentTicket = tickets.find(t => t.id === chatState?.ticketKey) ?? null

  useEffect(() => {
    setShowChatMenu(false)
    setRenamingTitle(false)
    setConfirmDeleteChat(false)
  }, [chatState?.ticketKey])

  const toggleChatPin = () => {
    if (!currentTicket) return
    updateTicket(currentTicket.id, { pinned: !currentTicket.pinned })
    refresh()
    setShowChatMenu(false)
  }

  const toggleChatUnread = () => {
    if (!currentTicket) return
    updateTicket(currentTicket.id, { unread: !currentTicket.unread })
    refresh()
    setShowChatMenu(false)
  }

  const startChatRename = () => {
    if (!currentTicket) return
    setRenameValue(currentTicket.summary)
    setRenamingTitle(true)
    setShowChatMenu(false)
  }

  const commitChatRename = () => {
    if (currentTicket) {
      const value = renameValue.trim()
      if (value && value !== currentTicket.summary) {
        updateTicket(currentTicket.id, { summary: value })
        setChatState(prev => (prev ? { ...prev, prompt: value } : prev))
        refresh()
      }
    }
    setRenamingTitle(false)
  }

  const handleChatPromptUpdate = (text: string) => {
    if (!currentTicket) return
    updateTicket(currentTicket.id, { summary: text, description: text })
    setChatState(prev => (prev ? { ...prev, prompt: text } : prev))
    refresh()
  }

  const handleDeleteChat = () => {
    setShowChatMenu(false)
    setConfirmDeleteChat(true)
  }

  const confirmDeleteChatNow = () => {
    if (!currentTicket) return
    deleteTicket(currentTicket.id)
    refresh()
    setChatState(null)
    setConfirmDeleteChat(false)
  }

  const notifications = tickets.filter(t => t.status === 'done' && t.unread)

  const openNotification = (t: LocalTicket) => {
    setShowNotifMenu(false)
    updateTicket(t.id, { unread: false })
    refresh()
    setChatState({ prompt: t.summary, ticketKey: t.id, autoRun: false })
    setActiveNav('home')
  }

  const openShareModal = () => {
    if (!currentTicket) return
    setShowMoreMenu(false)
    setShowNotifMenu(false)
    setShareVisibility('private')
    setShowShareModal(true)
  }

  const handleCreateShareLink = () => {
    if (!currentTicket) return
    const url = `${window.location.origin}/dashboard?ticket=${currentTicket.id}${shareVisibility === 'shared' ? '&shared=1' : ''}`
    void navigator.clipboard.writeText(url)
    setShowShareModal(false)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 1500)
  }

  const handleExportMarkdown = () => {
    if (!currentTicket) return
    setShowMoreMenu(false)
    const md = currentTicket.content ?? currentTicket.description
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentTicket.summary.slice(0, 60).replace(/[^\w\- ]/g, '').trim() || 'sandwich'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const byType = (type: TicketType) => tickets.filter(t => t.type === type)
  const isHomePage = activeNav === 'home'

  const renderPage = () => {
    if (activeNav === 'settings') return <Settings />
    if (activeNav === 'help') return <HelpPage />

    if (activeNav === 'briefs') return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>MY BRIEFS</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{tickets.length} {tr('dash_docs_saved')}</p>
          </div>
          <TicketList tickets={tickets} onOpen={(t) => setChatState({ prompt: t.summary, ticketKey: t.id, autoRun: false })} onNew={() => setActiveNav('home')} />
        </div>
      </div>
    )

    if (activeNav === 'templates') return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>TEMPLATES</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{tr('dash_templates_sub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{tr('dash_click_to_start')}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )

    const pp = PIPELINE_MAP[activeNav]
    if (!pp) return null

    const items = byType(pp.type)

    if (items.length > 0 && !creatingNew) {
      return (
        <ArtifactGrid
          title={pp.title}
          items={items}
          onOpen={(t) => setChatState({ prompt: t.summary, ticketKey: t.id, autoRun: false })}
          onNew={() => setCreatingNew(true)}
        />
      )
    }

    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
        {items.length > 0 && (
          <button
            onClick={() => setCreatingNew(false)}
            className="flex items-center gap-1.5 text-xs font-medium mb-6 transition-colors"
            style={{ color: 'rgba(0,0,0,0.4)' }}
          >
            <iconify-icon icon="solar:arrow-left-linear" width="13" />
            {tr('dash_back_to_list')}
          </button>
        )}
        <h1 className="text-2xl md:text-3xl text-center mb-8 tracking-tighter" style={{ color: '#111827', fontFamily: bowlby, maxWidth: '560px' }}>
          {tr('dash_home_headline_pipeline')}
        </h1>
        <div className="w-full max-w-2xl">
          <PromptBox defaultType={pp.type} onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F4EBE1', fontFamily: inter }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        <aside className="flex flex-col w-56 shrink-0 fixed md:static inset-y-0 left-0 z-50 md:z-auto h-full" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
              <span className="text-white font-black text-xs" style={{ fontFamily: bowlby }}>S</span>
            </div>
            <span className="font-bold text-sm tracking-wide text-white" style={{ fontFamily: bowlby }}>SANDWICH</span>
          </div>
          <button className="p-1 rounded transition-colors hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
            <iconify-icon icon="solar:sidebar-minimalistic-linear" width="15" style={{ color: '#ffffff' }} />
          </button>
        </div>

        {/* Fixed top nav */}
        <div className="px-2 mt-3 shrink-0">
          {/* New Chat button */}
          <button
            onClick={() => { setActiveNav('home'); setChatState(null); if (window.innerWidth < 768) setSidebarOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors text-left"
            style={activeNav === 'home' && !chatState
              ? { backgroundColor: '#f91814', color: '#ffffff' }
              : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }
            }
            onMouseEnter={e => { if (!(activeNav === 'home' && !chatState)) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { if (!(activeNav === 'home' && !chatState)) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
          >
            <iconify-icon icon="solar:chat-round-line-linear" width="15" />
            New Chat
            <iconify-icon icon="solar:pen-new-square-linear" width="13" style={{ marginLeft: 'auto', color: '#ffffff' }} />
          </button>

          {/* Pipeline items */}
          <div className="mt-3 mb-1">
            {NAV.map(item => {
              const isActive = activeNav === item.id
              const count = byType(PIPELINE_MAP[item.id]?.type ?? 'general' as TicketType).length
              return (
                <button key={item.id} onClick={() => { setActiveNav(item.id); setChatState(null); setCreatingNew(false); if (window.innerWidth < 768) setSidebarOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left mb-0.5"
                  style={isActive ? { backgroundColor: '#f91814', color: '#ffffff', fontWeight: 500 } : { color: 'rgba(255,255,255,0.5)' }}
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
          </div>
        </div>

        {/* Chat history — scrollable, separated by big gap */}
        <div className="flex-1 min-h-0 flex flex-col mt-8 px-2">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase shrink-0" style={{ color: '#ffffff' }}>{tr('dash_chat_history')}</p>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {tickets.length === 0 ? (
              <p className="px-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{tr('dash_no_chats')}</p>
            ) : (
              tickets.slice().reverse().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).map(t => {
                const meta = TYPE_META[t.type] ?? TYPE_META.general
                const isActive = chatState?.ticketKey === t.id
                return (
                  <button key={t.id}
                    onClick={() => {
                      setChatState({ prompt: t.summary, ticketKey: t.id, autoRun: false })
                      if (t.unread) updateTicket(t.id, { unread: false })
                      refresh()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left mb-0.5 transition-colors"
                    style={isActive ? {} : {}}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
                  >
                    <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center" style={{ backgroundColor: meta.color }}>
                      <iconify-icon icon={meta.icon} width="11" style={{ color: meta.ic }} />
                    </div>
                    <span className="text-xs truncate flex-1" style={{ color: isActive ? '#ffffff' : t.unread ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: t.unread ? 600 : 400 }}>{t.summary}</span>
                    {t.pinned && (
                      <iconify-icon icon="solar:pin-bold" width="10" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                    )}
                    {t.unread && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f91814' }} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="border-t px-2 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-0.5 transition-colors"
            style={{ color: activeNav === 'help' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', backgroundColor: activeNav === 'help' ? 'rgba(255,255,255,0.08)' : '' }}
            onClick={() => setActiveNav('help')}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = activeNav === 'help' ? 'rgba(255,255,255,0.08)' : '')}>
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
          <button onClick={() => setShowAccountMenu(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#f91814' }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-medium truncate text-white">{username}</p>
          </button>

          {showAccountMenu && (
            <div className="fixed inset-0 z-50" onClick={() => setShowAccountMenu(false)}>
              <style>{`@keyframes slideUp { from { transform: translateY(4px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
              <div className="absolute bottom-16 left-3 w-48 rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', animation: 'slideUp 0.15s ease-out' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-sm font-semibold text-white">{username}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{email}@local</p>
                </div>
                <div className="p-2">
                  <button onClick={() => { setShowAccountMenu(false); logout() }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                    style={{ color: '#f87171' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <iconify-icon icon="solar:logout-2-linear" width="15" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
      </>
      )}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b shrink-0 gap-2" style={{ backgroundColor: 'rgba(244,235,225,0.8)', borderColor: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button className="p-1.5 rounded-lg hover:bg-black/8 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
                <iconify-icon icon="solar:sidebar-minimalistic-linear" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
              </button>
            )}
            {chatState && (
              <div className="flex items-center gap-1 min-w-0">
                {renamingTitle ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitChatRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitChatRename()
                      if (e.key === 'Escape') setRenamingTitle(false)
                    }}
                    className="text-sm font-medium bg-transparent outline-none border-b min-w-0"
                    style={{ color: 'rgba(0,0,0,0.7)', borderColor: 'rgba(0,0,0,0.25)', width: 220 }}
                  />
                ) : (
                  <p className="text-sm font-medium truncate" style={{ color: 'rgba(0,0,0,0.6)' }}>{chatState.prompt}</p>
                )}
                <div className="relative shrink-0 flex items-center">
                  <button onClick={() => setShowChatMenu(v => !v)} className="p-1 rounded-md hover:bg-black/5 transition-colors flex items-center justify-center shrink-0">
                    <iconify-icon icon="solar:alt-arrow-down-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)', display: 'block' }} />
                  </button>
                  {showChatMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                      <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl overflow-hidden"
                        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="p-1.5">
                          <button onClick={toggleChatPin}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon={currentTicket?.pinned ? 'solar:pin-bold' : 'solar:pin-linear'} width="15" />
                            {currentTicket?.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={toggleChatUnread}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon={currentTicket?.unread ? 'solar:eye-linear' : 'solar:eye-closed-linear'} width="15" />
                            {currentTicket?.unread ? 'Mark as read' : 'Mark as unread'}
                          </button>
                          <button onClick={startChatRename}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon="solar:pen-2-linear" width="15" />
                            Rename
                          </button>
                          <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                          <button onClick={handleDeleteChat}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: '#f87171' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon="solar:trash-bin-trash-linear" width="15" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PlanBadge />
            {chatState && (<>
              <div className="relative">
                <button onClick={() => { setShowNotifMenu(v => !v); setShowMoreMenu(false) }} className="p-2 rounded-lg hover:bg-black/5 transition-colors relative">
                  <iconify-icon icon="solar:bell-linear" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f91814' }} />
                  )}
                </button>
                {showNotifMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl overflow-hidden"
                      style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)' }}
                      onClick={e => e.stopPropagation()}>
                      <div className="p-1.5 max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{tr('dash_no_notifications')}</p>
                        ) : notifications.map(t => (
                          <button key={t.id} onClick={() => openNotification(t)}
                            className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon="solar:check-circle-bold" width="15" style={{ color: '#f91814', marginTop: 1 }} />
                            <span className="truncate">{t.summary} {tr('dash_finished_processing')}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={openShareModal} className="p-2 rounded-lg hover:bg-black/5 transition-colors" title="Share chat">
                <iconify-icon icon={shareCopied ? 'solar:check-circle-linear' : 'solar:upload-linear'} width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
              </button>
              <div className="relative">
                <button onClick={() => { setShowMoreMenu(v => !v); setShowNotifMenu(false) }} className="p-2 rounded-lg hover:bg-black/5 transition-colors">
                  <iconify-icon icon="solar:menu-dots-bold" width="16" style={{ color: 'rgba(0,0,0,0.4)' }} />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl overflow-hidden"
                      style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)' }}
                      onClick={e => e.stopPropagation()}>
                      <div className="p-1.5">
                        <button onClick={handleExportMarkdown}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <iconify-icon icon="solar:download-minimalistic-linear" width="15" />
                          Download Markdown
                        </button>
                        <button onClick={() => { setShowMoreMenu(false); setActiveNav('settings'); setChatState(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <iconify-icon icon="solar:settings-linear" width="15" />
                          Settings
                        </button>
                        <button onClick={() => { setShowMoreMenu(false); setActiveNav('help'); setChatState(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <iconify-icon icon="solar:question-circle-linear" width="15" />
                          Help
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>)}
          </div>
        </div>

        {/* Content */}
        {chatState ? (
          <div className="flex-1 min-h-0">
            <ChatView
              initialPrompt={chatState.prompt}
              ticketKey={chatState.ticketKey}
              createdAt={currentTicket?.createdAt ?? new Date().toISOString()}
              autoRun={chatState.autoRun}
              onPromptUpdate={handleChatPromptUpdate}
            />
          </div>
        ) : isHomePage ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
            <h1 className="text-2xl md:text-3xl text-center mb-8 tracking-tighter" style={{ color: '#111827', fontFamily: bowlby, maxWidth: '560px' }}>
              {tr('dash_home_headline')}
            </h1>
            <div className="w-full max-w-2xl">
              <PromptBox onSuccess={handleSuccess} />
            </div>
          </div>
        ) : renderPage()}
      </main>


      {selected && <Drawer ticket={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}

      <ConfirmDeleteModal
        open={confirmDeleteChat}
        title="Delete Chat"
        itemName={currentTicket?.summary ?? ''}
        onConfirm={confirmDeleteChatNow}
        onCancel={() => setConfirmDeleteChat(false)}
      />

      {showShareModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowShareModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="ds-card-outer ds-shadow-elevated w-full max-w-md" style={{ height: 'auto' }}>
              <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(249,24,20,0.15)' }}>
                    <iconify-icon icon="solar:share-linear" width="15" style={{ color: '#f91814' }} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-white ds-text-shadow">{tr('share_title')}</h3>
                  <button onClick={() => setShowShareModal(false)}
                    className="ml-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <iconify-icon icon="solar:close-circle-linear" width="18" />
                  </button>
                </div>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{tr('share_subtitle')}</p>

                <div className="flex flex-col gap-2 mb-6">
                  {([
                    { key: 'private' as const, icon: 'solar:lock-keyhole-linear', title: tr('share_private_title'), desc: tr('share_private_desc') },
                    { key: 'shared' as const, icon: 'solar:link-round-angle-linear', title: tr('share_shared_title'), desc: tr('share_shared_desc') },
                  ]).map(opt => {
                    const active = shareVisibility === opt.key
                    return (
                      <button key={opt.key} onClick={() => setShareVisibility(opt.key)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors"
                        style={{
                          backgroundColor: active ? 'rgba(249,24,20,0.08)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1px solid rgba(249,24,20,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: active ? 'rgba(249,24,20,0.15)' : 'rgba(255,255,255,0.06)' }}>
                          <iconify-icon icon={opt.icon} width="16" style={{ color: active ? '#f91814' : 'rgba(255,255,255,0.55)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{opt.title}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</p>
                        </div>
                        <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${active ? '#f91814' : 'rgba(255,255,255,0.25)'}` }}>
                          {active && <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: '#f91814' }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-end">
                  <button onClick={handleCreateShareLink}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#f91814' }}>
                    <iconify-icon icon="solar:link-round-linear" width="14" />
                    {tr('share_create_link')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
