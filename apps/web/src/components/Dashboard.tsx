import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { marked } from 'marked'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { getConversations, loadConversations, createConversationLocal, updateLocalConversation, deleteLocalConversation, type LocalConversation, type ConversationType } from '../lib/conversations'
import { updateConversation as updateConversationApi, uploadAttachment, shareConversation, unshareConversation, createMessage, generateConversation, getMessages, type Attachment } from '../api/conversations'
import { useUsage } from '../hooks/useUsage'
import { apiUrl } from '../api/base'
import Settings from './Settings'
import HelpPage from './HelpPage'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import DocumentsPanel from './DocumentsPanel'
import DocumentCard from './DocumentCard'
import DocumentReaderPanel from './DocumentReaderPanel'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'
import { useLanguage, type StringKey } from '../lib/i18n'

interface AttachedFile { name: string; type: string; dataUrl: string }

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',')
  const mime = meta?.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bytes = atob(data ?? '')
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

const bowlby = "'Bowlby One', system-ui"
const inter = "'Inter', sans-serif"

const NAV = [
  { label: 'Documents', icon: 'solar:folder-linear', id: 'documents' },
]

const QUICK_TYPES = [
  { label: 'PRD Lengkap',          type: 'prd'       as ConversationType, icon: 'solar:document-add-linear',        color: '#fef3c7', iconColor: '#f97316', prompt: 'Buatkan PRD lengkap untuk ' },
  { label: 'Prototype Brief',      type: 'prototype'  as ConversationType, icon: 'solar:widget-linear',              color: '#ede9fe', iconColor: '#7c3aed', prompt: 'Buatkan prototype brief untuk ' },
  { label: 'Workflow Automations', type: 'workflow'   as ConversationType, icon: 'solar:settings-minimalistic-linear', color: '#dbeafe', iconColor: '#2563eb', prompt: 'Buatkan workflow automation untuk ' },
  { label: 'MOM Meeting',          type: 'mom'        as ConversationType, icon: 'solar:calendar-linear',            color: '#dcfce7', iconColor: '#16a34a', prompt: 'Buatkan MOM untuk ' },
  { label: 'Quotation Brief',      type: 'quotation'  as ConversationType, icon: 'solar:dollar-minimalistic-linear', color: '#fce7f3', iconColor: '#db2777', prompt: 'Buatkan quotation untuk ' },
  { label: 'Specs & Task',         type: 'specs'      as ConversationType, icon: 'solar:checklist-linear',           color: '#f0fdf4', iconColor: '#15803d', prompt: 'Buatkan specs dan task untuk ' },
]

const PIPELINE_MAP: Record<string, { type: ConversationType; title: string; desc: string; prompt: string; chip: string }> = {
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
  conversationId?: string
  document?: { id: string; type?: string; title?: string; versionNo?: number }
}

interface Turn {
  user: string
  attachments: Attachment[]
  aiMessages: ChatMessage[]
}

function usePipelineStream(conversationId: string | null, regenNonce: number, autoRun: boolean, regenerateRef: { current: boolean }, onDone?: (output: string) => void, onSettled?: () => void) {
  const { t: tr } = useLanguage()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    if (!conversationId) return
    // Don't auto-generate when opening existing conversation from history (regenNonce=0 and autoRun=false)
    if (!autoRun && regenNonce === 0) return
    setMessages([])
    setStreaming(true)

    const ctrl = new AbortController()

    // Trigger generate FIRST so inFlight is set before stream connects.
    // Stream checks inFlight on connect — if empty it closes immediately.
    generateConversation(conversationId, { regenerate: regenerateRef.current }).catch(() => {})

    // Small delay so inFlight is registered before stream opens
    const streamPromise = new Promise<Response>(resolve =>
      setTimeout(() => resolve(fetch(apiUrl(`/api/conversations/${conversationId}/stream`), { credentials: 'include', signal: ctrl.signal })), 100)
    )

    streamPromise
      .then(async res => {
        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''
        try {
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
                const ev = JSON.parse(line) as { type: string; stage?: string; text?: string; document?: { id: string; type?: string; title?: string; versionNo?: number }; conversation?: { output?: string | null } }
                if (ev.type === 'stage_start' && ev.stage) {
                  setMessages(m => [...m, { role: 'ai', stage: ev.stage }])
                } else if (ev.type === 'done') {
                  const output = ev.text ?? ''
                  setMessages(m => [...m, { role: 'ai', isDone: true, output, document: ev.document }])
                  setStreaming(false)
                  onDone?.(output)
                } else if (ev.type === 'error') {
                  const errText = ev.text ?? tr('pipeline_error')
                  setMessages(m => [...m, { role: 'ai', isError: true, text: errText }])
                  setStreaming(false)
                }
              } catch { /* skip bad JSON */ }
            }
          }
        } finally {
          setStreaming(false)
          onSettled?.()
        }
      })
      .catch(() => {
        setStreaming(false)
        onSettled?.()
      })

    return () => ctrl.abort()
  }, [conversationId, regenNonce])

  return { messages, streaming }
}

function AiMessageActions({ output, conversationId, onRegenerate }: { output: string; conversationId: string; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)

  const handleCopy = () => {
    void navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const sendFeedback = (value: 'like' | 'dislike') => {
    const next = feedback === value ? null : value
    setFeedback(next)
    fetch(apiUrl(`/api/conversations/${conversationId}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedback: next }),
    }).catch(() => {})
  }

  const btnClass = "p-1.5 rounded-md transition-colors hover:bg-black/5"
  const iconColor = 'rgba(0,0,0,0.35)'
  const activeColor = '#f91814'

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={handleCopy} className={btnClass} title="Copy">
        <iconify-icon icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width="14" style={{ color: copied ? activeColor : iconColor }} />
      </button>
      <button onClick={() => sendFeedback('like')} className={btnClass} title="Like">
        <iconify-icon icon="solar:like-linear" width="14" style={{ color: feedback === 'like' ? activeColor : iconColor }} />
      </button>
      <button onClick={() => sendFeedback('dislike')} className={btnClass} title="Dislike">
        <iconify-icon icon="solar:dislike-linear" width="14" style={{ color: feedback === 'dislike' ? activeColor : iconColor }} />
      </button>
      <button onClick={onRegenerate} className={btnClass} title="Regenerate">
        <iconify-icon icon="solar:refresh-linear" width="14" style={{ color: iconColor }} />
      </button>
    </div>
  )
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
  ],
}

function PlanBadge() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: sub } = useSubscription()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const plan = sub?.planSlug
  if (!plan) return null
  const isPro = plan === 'pro'
  const benefits = PLAN_BENEFITS[plan] ?? PLAN_BENEFITS.starter

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
            <a
              href="/checkout?plan=pro"
              className="w-full mt-4 py-2 rounded-full text-xs font-semibold text-white flex items-center justify-center"
              style={{ backgroundColor: '#f91814' }}
            >
              Upgrade to Pro
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function fileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toUpperCase().slice(0, 4) : 'FILE'
}

function AttachmentTile({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType?.startsWith('image/')
  const ext = fileExtension(attachment.filename)
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      title={attachment.filename}
      className="relative w-20 h-20 rounded-lg overflow-hidden border group shrink-0"
      style={{ borderColor: 'rgba(0,0,0,0.1)', backgroundColor: '#ffffff' }}
    >
      {isImage ? (
        <img src={attachment.url} alt={attachment.filename} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h12M4 17h8" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <span
        className="absolute bottom-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: '#ffffff' }}
      >
        {ext}
      </span>
    </a>
  )
}

function ChatView({
  initialPrompt,
  conversationId,
  createdAt,
  autoRun,
  onPromptUpdate,
  onOpenDocument,
}: {
  initialPrompt: string
  conversationId: string
  createdAt: string
  autoRun: boolean
  onPromptUpdate: (text: string) => void
  onOpenDocument: (id: string) => void
}) {
  const { t: tr } = useLanguage()
  const [regenNonce, setRegenNonce] = useState(0)
  const regenerateRef = useRef(false)
  // turns = committed past exchanges; liveMessages = current stream in progress
  const [turns, setTurns] = useState<Turn[]>([
    { user: initialPrompt, attachments: [], aiMessages: [] }
  ])

  // Reconstruct committed turns from the DB history.
  const reloadTurns = useCallback(() => {
    if (!conversationId) return
    getMessages(conversationId)
      .then((msgs) => {
        if (!msgs.length) return
        const reconstructed: Turn[] = []
        let currentUser = ''
        let currentAttachments: Attachment[] = []
        let currentAi: ChatMessage[] = []
        for (const m of msgs) {
          if (m.role === 'user') {
            if (currentUser) {
              reconstructed.push({ user: currentUser, attachments: currentAttachments, aiMessages: currentAi })
            }
            currentUser = m.content
            currentAttachments = m.attachments ?? []
            currentAi = []
          } else if (m.role === 'assistant') {
            currentAi.push({ role: 'ai', isDone: true, output: m.content, document: m.documentId ? { id: m.documentId } : undefined })
          }
        }
        if (currentUser) {
          reconstructed.push({ user: currentUser, attachments: currentAttachments, aiMessages: currentAi })
        }
        if (reconstructed.length > 0) {
          setTurns(reconstructed)
        }
      })
      .catch(() => {})
  }, [conversationId])

  const { messages: liveMessages, streaming } = usePipelineStream(conversationId, regenNonce, autoRun, regenerateRef, (output) => {
    updateLocalConversation(conversationId, { content: output, status: 'done' })
  }, () => { void reloadTurns() })
  const [followUp, setFollowUp] = useState('')
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const [editingTurnIndex, setEditingTurnIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [liveMessages, streaming])

  // Load saved messages when opening a conversation.
  useEffect(() => { reloadTurns() }, [reloadTurns])

  const handleRefreshResponse = () => {
    if (streaming) return
    regenerateRef.current = true
    setRegenNonce(n => n + 1)
  }

  const handleStartEdit = (index: number) => {
    setEditValue(turns[index].user)
    setEditingTurnIndex(index)
  }

  const handleSaveEdit = (index: number) => {
    const text = editValue.trim()
    setEditingTurnIndex(null)
    if (!text || text === turns[index].user) return
    if (index === 0) {
      onPromptUpdate(text)
      updateConversationApi(conversationId, { title: text, prompt: text }).catch(() => {})
    }
    setTurns(prev => prev.map((t, i) => i === index ? { ...t, user: text } : t))
    setRegenNonce(n => n + 1)
  }

  const handleCopyPrompt = () => {
    void navigator.clipboard.writeText(initialPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSend = async () => {
    if (!followUp.trim() || streaming) return
    setChatError(null)
    try {
      const uploaded: Attachment[] = []
      for (const a of attachments) {
        try {
          uploaded.push(await uploadAttachment(dataUrlToBlob(a.dataUrl), a.name, conversationId))
        } catch {
          /* skip failed upload — keep the message text */
        }
      }
      const text = followUp.trim()
      const message = await createMessage(conversationId, {
        content: text,
        attachmentIds: uploaded.map(a => a.id),
      })
      setFollowUp('')
      setAttachments([])
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      // Commit current live messages into the previous turn, then start a new one.
      setTurns(prev => {
        const last = prev[prev.length - 1]
        return [
          ...prev.slice(0, -1),
          { ...last, aiMessages: liveMessages },
          { user: message.content, attachments: message.attachments, aiMessages: [] },
        ]
      })

      regenerateRef.current = false
      setRegenNonce(n => n + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'chat quota reached') setChatError(tr('chat_quota_reached'))
      else if (msg === 'active subscription required') setChatError(tr('dash_expired_error'))
      else setChatError(tr('dash_generic_error'))
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#f4ebe1', fontFamily: inter }}>
      {/* Thread */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

          {/* Render all turns (committed) then live stream for the last one */}
          {turns.map((turn, ti) => {
            const isLast = ti === turns.length - 1
            const msgs = isLast && liveMessages.length > 0 ? liveMessages : turn.aiMessages
            return (
              <div key={ti} className="flex flex-col gap-8">
                {/* Attachments + user bubble */}
                <div className="flex flex-col items-end gap-2">
                  {turn.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {turn.attachments.map(a => <AttachmentTile key={a.id} attachment={a} />)}
                    </div>
                  )}
                  <div className="max-w-[75%] flex flex-col items-end gap-1.5 group">
                    {editingTurnIndex === ti ? (
                      <div className="w-full rounded-2xl px-4 py-3" style={{ backgroundColor: '#1a1a1a' }}>
                        <textarea
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSaveEdit(ti) }
                            if (e.key === 'Escape') setEditingTurnIndex(null)
                          }}
                          rows={Math.min(10, editValue.split('\n').length + 1)}
                          className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
                          style={{ color: '#ffffff' }}
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button onClick={() => setEditingTurnIndex(null)} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(ti)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors" style={{ backgroundColor: '#f91814' }}>
                            {tr('dash_save_resend')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-3 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                        {turn.user}
                      </div>
                    )}
                    {editingTurnIndex !== ti && (
                      <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{timeAgo(createdAt, tr)}</span>
                        {isLast && (
                          <button onClick={handleRefreshResponse} disabled={streaming}
                            className="p-1 rounded-md hover:bg-black/5 transition-colors disabled:opacity-30" title="Refresh respond">
                            <iconify-icon icon="solar:refresh-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                          </button>
                        )}
                        <button onClick={() => handleStartEdit(ti)} className="p-1 rounded-md hover:bg-black/5 transition-colors" title="Edit">
                          <iconify-icon icon="solar:pen-2-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                        </button>
                        <button onClick={handleCopyPrompt} className="p-1 rounded-md hover:bg-black/5 transition-colors" title="Copy">
                          <iconify-icon icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI messages for this turn */}
                {msgs.map((m, i) => {
                  if (m.isDone && m.output && m.document) return (
                    <div key={i} className="group relative">
                      <DocumentCard
                        documentId={m.document.id}
                        initial={m.document}
                        onClick={() => onOpenDocument(m.document!.id)}
                      />
                      {/* SANDWICH logo + hover actions */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5" style={{ color: 'rgba(0,0,0,0.25)' }}>
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814', opacity: 0.55 }}>
                            <span className="text-white font-black" style={{ fontSize: '7px', fontFamily: "'Bowlby One', system-ui" }}>S</span>
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <AiMessageActions output={m.output} conversationId={conversationId} onRegenerate={handleRefreshResponse} />
                        </div>
                      </div>
                    </div>
                  )
                  if (m.isDone && m.output) return (
                    <div key={i} className="group relative">
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      </div>
                      <div className="text-sm break-words sandwich-output" style={{ color: 'rgba(0,0,0,0.8)', lineHeight: '1.85' }}
                        dangerouslySetInnerHTML={{ __html: marked.parse(m.output) as string }} />
                      {/* SANDWICH logo + hover actions */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5" style={{ color: 'rgba(0,0,0,0.25)' }}>
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814', opacity: 0.55 }}>
                            <span className="text-white font-black" style={{ fontSize: '7px', fontFamily: "'Bowlby One', system-ui" }}>S</span>
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <AiMessageActions output={m.output} conversationId={conversationId} onRegenerate={handleRefreshResponse} />
                        </div>
                      </div>
                    </div>
                  )
                  if (m.isError) return (
                    <div key={i} className="text-sm break-words" style={{ color: '#f87171' }}>{m.text}</div>
                  )
                  return null
                })}

                {/* Loading state — shown while streaming */}
                {isLast && streaming && !msgs.some(m => m.isDone || m.isError) && (
                  <div className="flex flex-col gap-2">
                    {msgs.filter(m => m.stage).slice(-1).map((m, i) => (
                      <p key={i} className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        {m.stage! in STAGE_LABEL_KEYS ? tr(STAGE_LABEL_KEYS[m.stage!]) : m.stage}
                      </p>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(0,0,0,0.25)', animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(0,0,0,0.25)', animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'rgba(0,0,0,0.25)', animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — Claude style floating */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <div className="max-w-3xl mx-auto rounded-2xl" style={{ backgroundColor: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)' }}>
          {chatError && (
            <p className="px-5 pt-3 text-xs" style={{ color: '#f91814' }}>{chatError}</p>
          )}
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


// ── Plan limit (server-side) ────────────────────────────────────────────────
interface PlanUsage { used: number; prototypeUsed: number; chatUsed: number; limit: number | null; prototypeLimit: number | null; chatLimit: number | null; isPro: boolean }
function isAtLimit(u: PlanUsage): boolean {
  return !u.isPro && u.limit !== null && u.used >= u.limit
}

// ── Prompt Box (reusable) ──────────────────────────────────────────────────────
interface PromptBoxProps {
  defaultType?: ConversationType
  onSuccess: (t: LocalConversation) => void
  usage: PlanUsage
}
function loadDraft(): { prompt: string; attachments: AttachedFile[]; activeType: ConversationType | null } {
  try {
    const raw = localStorage.getItem('sandwich_draft')
    if (!raw) return { prompt: '', attachments: [], activeType: null }
    localStorage.removeItem('sandwich_draft')
    const parsed = JSON.parse(raw) as { prompt?: string; attachments?: AttachedFile[]; activeType?: ConversationType }
    return { prompt: parsed.prompt ?? '', attachments: parsed.attachments ?? [], activeType: parsed.activeType ?? null }
  } catch {
    return { prompt: '', attachments: [], activeType: null }
  }
}

function PromptBox({ defaultType = 'general', onSuccess, usage }: PromptBoxProps) {
  const { t: tr } = useLanguage()
  const [draft] = useState(loadDraft)
  const [prompt, setPrompt] = useState(draft.prompt)
  const [pendingType, setPendingType] = useState<string>(draft.activeType ?? (defaultType === 'general' ? '' : defaultType))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>(draft.attachments)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const atLimit = isAtLimit(usage)

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
      const local = await createConversationLocal({ type: 'general', pendingType: pendingType || undefined, summary: prompt.trim(), description: prompt.trim() })
      const uploaded: Attachment[] = []
      for (const a of attachments) {
        try {
          uploaded.push(await uploadAttachment(dataUrlToBlob(a.dataUrl), a.name, local.id))
        } catch {
          /* skip failed upload */
        }
      }
      await createMessage(local.id, { content: prompt.trim(), attachmentIds: uploaded.map(a => a.id) })
      setPrompt('')
      setAttachments([])
      onSuccess(local)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'active subscription required') setError(tr('dash_expired_error'))
      else if (msg === 'monthly quota reached') setError(tr('plan_limit_desc'))
      else if (msg === 'prototype quota reached') setError(tr('prototype_quota_reached'))
      else setError(msg || tr('dash_generic_error'))
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
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
        {!usage.isPro && !atLimit && (
          <span className="ml-auto shrink-0 text-[11px] pl-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{usage.used}/{usage.limit ?? '∞'} this month</span>
        )}
      </div>

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

// ── Conversation List ────────────────────────────────────────────────────────────────
function ConversationList({ conversations, onOpen, onNew }: { conversations: LocalConversation[]; onOpen: (t: LocalConversation) => void; onNew: () => void }) {
  const { lang, t: tr } = useLanguage()
  if (conversations.length === 0) {
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
      {conversations.map(t => {
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

// ── Home Overview ────────────────────────────────────────────────────────────
const DAY_LABELS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function HomeOverview({
  conversations,
  username,
  usage,
  onSuccess,
  onOpenConversation,
  onGoTemplates,
  onGoBriefs,
  onGoType,
}: {
  conversations: LocalConversation[]
  username: string
  usage: PlanUsage
  onSuccess: (t: LocalConversation) => void
  onOpenConversation: (t: LocalConversation) => void
  onGoTemplates: () => void
  onGoBriefs: () => void
  onGoType: (type: ConversationType) => void
}) {
  const { lang, t: tr } = useLanguage()
  const [filter, setFilter] = useState<'all' | 'done' | 'draft'>('all')
  const { data: sub } = useSubscription()
  const plan = sub?.planSlug

  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const doneCount = conversations.filter(t => t.status === 'done').length
  const draftCount = conversations.filter(t => t.status === 'draft').length
  const weekConversations = conversations.filter(t => now - new Date(t.createdAt).getTime() < weekMs)

  const hour = new Date().getHours()
  const greetingKey = hour < 11 ? 'home_greeting_morning' : hour < 15 ? 'home_greeting_afternoon' : hour < 19 ? 'home_greeting_evening' : 'home_greeting_night'
  const dateStr = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const dayBuckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 24 * 60 * 60 * 1000)
    d.setHours(0, 0, 0, 0)
    const count = conversations.filter(t => {
      const ct = new Date(t.createdAt); ct.setHours(0, 0, 0, 0)
      return ct.getTime() === d.getTime()
    }).length
    return { label: DAY_LABELS_ID[d.getDay()], count }
  })
  const maxDay = Math.max(1, ...dayBuckets.map(d => d.count))

  const filteredConversations = conversations.filter(t => filter === 'all' ? true : filter === 'done' ? t.status === 'done' : t.status === 'draft')
  const distinctTypes = new Set(conversations.map(t => t.type)).size
  const checklist = [
    { key: 'home_check_1', done: conversations.length > 0 },
    { key: 'home_check_2', done: doneCount > 0 },
    { key: 'home_check_3', done: distinctTypes >= 3 },
    { key: 'home_check_5', done: usage.isPro },
  ] as const
  const checklistDone = checklist.filter(c => c.done).length

  const cardStyle = { backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }
  const sectionStyle = { backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(0,0,0,0.08)' }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#f91814' }}>{dateStr}</p>
            <h1 className="text-2xl tracking-tighter mt-1" style={{ color: '#111827', fontFamily: bowlby }}>{tr(greetingKey).toUpperCase()}, {username.toUpperCase()}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>
              {conversations.length === 0 ? tr('home_subtitle_empty') : tr('home_subtitle_count').replace('{n}', String(conversations.length))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGoTemplates} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827', backgroundColor: '#ffffff' }}>
              <iconify-icon icon="solar:widget-linear" width="14" />
              {tr('home_templates_btn')}
            </button>
            <button onClick={onGoBriefs} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:folder-linear" width="14" />
              {tr('home_all_briefs_btn')}
            </button>
          </div>
        </div>

        {/* Expiry notice — proactive + mid-session */}
        {(sub?.expired || (sub?.expiresAt && new Date(sub.expiresAt).getTime() - now < 24 * 60 * 60 * 1000)) && (
          <a href="/checkout?expired=1" className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: 'rgba(249,24,20,0.1)', color: '#f91814', border: '1px solid rgba(249,24,20,0.25)' }}>
            <span>{sub?.expired ? tr('dash_expired_banner') : tr('dash_expiring_banner')}</span>
            <span className="shrink-0">{tr('plan_limit_upgrade')}</span>
          </a>
        )}

        {/* Prompt box */}
        <PromptBox onSuccess={onSuccess} usage={usage} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: 'solar:document-linear', color: '#fef3c7', ic: '#f97316', label: tr('home_stat_total'), value: conversations.length },
            { icon: 'solar:check-circle-linear', color: '#dcfce7', ic: '#16a34a', label: tr('home_stat_done'), value: doneCount },
            { icon: 'solar:hourglass-linear', color: '#dbeafe', ic: '#2563eb', label: tr('home_stat_draft'), value: draftCount },
            { icon: 'solar:graph-new-up-linear', color: '#fce7f3', ic: '#db2777', label: tr('home_stat_week'), value: weekConversations.length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color }}>
                  <iconify-icon icon={s.icon} width="15" style={{ color: s.ic }} />
                </div>
                <span className="text-sm" style={{ color: '#6b7280' }}>{s.label}</span>
              </div>
              <p className="text-3xl font-semibold" style={{ color: '#111827' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quota + Activity chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border p-6" style={cardStyle}>
            <h2 className="text-base tracking-tight" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_quota_title')}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{plan === 'pro' ? tr('home_quota_plan_pro') : tr('home_quota_plan_starter')}</p>
            <p className="text-3xl font-semibold mt-4" style={{ color: '#111827' }}>
              {usage.used}<span className="text-base font-normal" style={{ color: '#9ca3af' }}> / {usage.isPro ? '∞' : usage.limit} {tr('home_quota_documents')}</span>
            </p>
            <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
              <div className="h-full rounded-full" style={{ backgroundColor: '#f91814', width: usage.isPro ? '100%' : `${Math.min(100, (usage.used / (usage.limit ?? 1)) * 100)}%` }} />
            </div>
            <p className="text-sm mt-4" style={{ color: '#111827' }}>
              {usage.prototypeUsed}<span className="text-xs font-normal" style={{ color: '#9ca3af' }}> / {usage.isPro ? '∞' : usage.prototypeLimit} {tr('home_quota_prototypes')}</span>
            </p>
            <p className="text-sm mt-4" style={{ color: '#111827' }}>
              {usage.chatUsed}<span className="text-xs font-normal" style={{ color: '#9ca3af' }}> / {usage.isPro ? '∞' : usage.chatLimit} {tr('home_quota_chats')}</span>
            </p>
            {!usage.isPro && (
              <a href="/checkout?plan=pro" className="w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#f91814' }}>
                <iconify-icon icon="solar:crown-linear" width="14" />
                {tr('home_quota_upgrade')}
              </a>
            )}
            <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <span style={{ color: '#9ca3af' }}>{tr('home_quota_completion')}</span>
              <span className="font-semibold" style={{ color: '#111827' }}>{conversations.length ? Math.round((doneCount / conversations.length) * 100) : 0}%</span>
            </div>
          </div>

          <div className="rounded-2xl border p-6" style={cardStyle}>
            <h2 className="text-base tracking-tight" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_activity_title')}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{weekConversations.length === 0 ? tr('home_activity_sub_zero') : tr('home_activity_sub').replace('{n}', String(weekConversations.length))}</p>
            <div className="flex items-end justify-between gap-2 mt-6" style={{ height: 90 }}>
              {dayBuckets.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>{d.count || ''}</span>
                  <div className="w-full rounded-md" style={{ backgroundColor: d.count ? '#f91814' : '#f3f4f6', height: Math.max(4, (d.count / maxDay) * 60) }} />
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick start */}
        <div>
          <h2 className="text-base tracking-tight mb-0.5" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_quickstart_title')}</h2>
          <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>{tr('home_quickstart_sub')}</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_TYPES.map(t => (
              <button key={t.label} onClick={() => onGoType(t.type)}
                className="flex items-start gap-3 p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5"
                style={cardStyle}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.color }}>
                  <iconify-icon icon={t.icon} width="16" style={{ color: t.iconColor }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{t.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{conversations.filter(x => x.type === t.type).length} dibuat</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity + Breakdown/Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border p-6" style={sectionStyle}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base tracking-tight" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_recent_title')}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{tr('home_recent_sub').replace('{n}', String(conversations.length))}</p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                {([['all', 'home_filter_all'], ['done', 'home_filter_done'], ['draft', 'home_filter_draft']] as const).map(([key, labelKey]) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={filter === key ? { backgroundColor: '#111827', color: '#ffffff' } : { color: '#6b7280' }}>
                    {tr(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                  <iconify-icon icon="solar:notes-linear" width="22" style={{ color: 'rgba(0,0,0,0.3)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#374151' }}>{tr('home_recent_empty_title')}</p>
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{tr('home_recent_empty_sub')}</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)', backgroundColor: '#ffffff' }}>
                {filteredConversations.slice(0, 6).map(t => {
                  const meta = TYPE_META[t.type] ?? TYPE_META.general
                  return (
                    <button key={t.id} onClick={() => onOpenConversation(t)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left border-b last:border-b-0 transition-colors"
                      style={{ borderColor: 'rgba(0,0,0,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                          <iconify-icon icon={meta.icon} width="13" style={{ color: meta.ic }} />
                        </div>
                        <p className="text-sm truncate" style={{ color: '#111827' }}>{t.summary}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2" style={{
                        backgroundColor: t.status === 'done' ? '#dcfce7' : '#f3f4f6',
                        color: t.status === 'done' ? '#16a34a' : '#9ca3af',
                      }}>{t.status === 'done' ? 'Done' : t.status === 'processing' ? tr('dash_status_processing') : 'Draft'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border p-5" style={cardStyle}>
              <h2 className="text-base tracking-tight" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_breakdown_title')}</h2>
              <p className="text-xs mt-0.5 mb-3" style={{ color: '#9ca3af' }}>{tr('home_breakdown_sub')}</p>
              {conversations.length === 0 ? (
                <p className="text-xs" style={{ color: '#9ca3af' }}>{tr('home_breakdown_empty')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.keys(TYPE_META).filter(k => k !== 'general' && conversations.some(t => t.type === k)).map(k => {
                    const meta = TYPE_META[k]
                    const count = conversations.filter(t => t.type === k).length
                    return (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2" style={{ color: '#374151' }}>
                          <iconify-icon icon={meta.icon} width="13" style={{ color: meta.ic }} />
                          {meta.label}
                        </span>
                        <span className="font-medium" style={{ color: '#111827' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border p-5" style={cardStyle}>
              <h2 className="text-base tracking-tight" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_checklist_title')}</h2>
              <p className="text-xs mt-0.5 mb-3" style={{ color: '#9ca3af' }}>{tr('home_checklist_done').replace('{done}', String(checklistDone)).replace('{total}', String(checklist.length))}</p>
              <div className="flex flex-col gap-2.5">
                {checklist.map(c => (
                  <div key={c.key} className="flex items-center gap-2.5">
                    <iconify-icon icon={c.done ? 'solar:check-circle-bold' : 'solar:record-circle-linear'} width="16" style={{ color: c.done ? '#16a34a' : 'rgba(0,0,0,0.2)' }} />
                    <span className="text-xs" style={{ color: c.done ? '#111827' : '#9ca3af', textDecoration: c.done ? 'line-through' : 'none' }}>{tr(c.key)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div>
          <h2 className="text-base tracking-tight mb-0.5" style={{ color: '#111827', fontFamily: bowlby }}>{tr('home_tips_title')}</h2>
          <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>{tr('home_tips_sub')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: 'solar:target-linear', title: tr('home_tip_1_title'), desc: tr('home_tip_1_desc') },
              { icon: 'solar:paperclip-linear', title: tr('home_tip_2_title'), desc: tr('home_tip_2_desc') },
              { icon: 'solar:refresh-linear', title: tr('home_tip_3_title'), desc: tr('home_tip_3_desc') },
            ].map(tip => (
              <div key={tip.title} className="rounded-2xl border p-5" style={cardStyle}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(249,24,20,0.1)' }}>
                  <iconify-icon icon={tip.icon} width="15" style={{ color: '#f91814' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#111827' }}>{tip.title}</p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#9ca3af' }}>{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Help banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6" style={{ backgroundColor: '#111113' }}>
          <div>
            <p className="text-sm font-semibold text-white">{tr('home_help_title')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{tr('home_help_sub')}</p>
          </div>
          <a href="/dashboard" onClick={e => { e.preventDefault(); onGoTemplates() }} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#f91814' }}>
            <iconify-icon icon="solar:question-circle-linear" width="14" />
            {tr('home_help_cta')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
function Drawer({ conversation, onClose, onDelete }: { conversation: LocalConversation; onClose: () => void; onDelete: (id: string) => void }) {
  const meta = TYPE_META[conversation.type] ?? TYPE_META.general
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
              backgroundColor: conversation.status === 'done' ? '#dcfce7' : conversation.status === 'processing' ? '#fef3c7' : '#f3f4f6',
              color: conversation.status === 'done' ? '#16a34a' : conversation.status === 'processing' ? '#f97316' : '#6b7280'
            }}>
              {conversation.status === 'done' ? 'Selesai' : conversation.status === 'processing' ? 'Diproses' : 'Draft'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <iconify-icon icon="solar:close-linear" width="16" style={{ color: '#6b7280' }} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4 flex-1">
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {new Date(conversation.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <h2 className="text-base font-semibold leading-snug" style={{ color: '#111827' }}>{conversation.summary}</h2>
          {conversation.content ? (
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9ca3af' }}>Output</p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4" style={{ backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}>
                {conversation.content}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs py-3 px-4 rounded-xl" style={{ backgroundColor: '#f9fafb', color: '#9ca3af' }}>
              <iconify-icon icon="solar:hourglass-linear" width="14" />
              Brief dalam antrian — output akan muncul di sini
            </div>
          )}
          {conversation.description && (
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{conversation.description}</p>
          )}
          <p className="text-xs font-mono" style={{ color: '#d1d5db' }}>ID: {conversation.id}</p>
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
              <button onClick={() => { onDelete(conversation.id); onClose() }}
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
  const [conversations, setConversations] = useState<LocalConversation[]>([])
  const [selected, setSelected] = useState<LocalConversation | null>(null)
  const [activeNav, setActiveNav] = useState('home')

  const [chatState, setChatState] = useState<{ prompt: string; conversationId: string; autoRun: boolean } | null>(() => {
    const saved = localStorage.getItem('sandwich_last_chat')
    if (!saved) return null
    try {
      const parsed = JSON.parse(saved) as { prompt: string; conversationId: string; autoRun?: boolean }
      return { prompt: parsed.prompt, conversationId: parsed.conversationId, autoRun: parsed.autoRun === true }
    } catch { return null }
  })
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [contextMenuConversation, setContextMenuConversation] = useState<string | null>(null)
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [renameConversationValue, setRenameConversationValue] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareVisibility, setShareVisibility] = useState<'private' | 'shared'>('private')
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const { logout, state: authState } = useAuth()
  const usageQuery = useUsage()
  const usage: PlanUsage = usageQuery.data ?? { used: 0, prototypeUsed: 0, chatUsed: 0, limit: 5, prototypeLimit: 3, chatLimit: 100, isPro: false }
  const username = authState.status === 'authenticated' ? authState.username : 'sandwich'
  const email = authState.status === 'authenticated' ? (authState as { email?: string }).email ?? username : username

  const { data: sub, isLoading: subLoading } = useSubscription()
  const queryClient = useQueryClient()

  // Fire Snap for a pending Pro upgrade set during registration
  useEffect(() => {
    const pending = localStorage.getItem('sandwich_pending_plan')
    if (pending !== 'pro') return
    localStorage.removeItem('sandwich_pending_plan') // clear immediately — don't loop

    const fireSnap = async () => {
      try {
        const txRes = await fetch(apiUrl('/api/midtrans/transaction'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ planSlug: 'pro' }),
        })
        if (!txRes.ok) return
        const data = await txRes.json() as {
          token: string | null
          simulated: boolean
          clientKey: string
          isProduction: boolean
        }
        if (data.simulated || !data.token) {
          queryClient.invalidateQueries({ queryKey: ['subscription'] })
          return
        }
        await new Promise<void>((resolve, reject) => {
          const w = window as unknown as Record<string, unknown>
          if (w.snap) { resolve(); return }
          const script = document.createElement('script')
          script.src = data.isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js'
          script.setAttribute('data-client-key', data.clientKey)
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Snap.js failed to load'))
          document.head.appendChild(script)
        })
        ;(window as unknown as { snap: { pay: (token: string, opts: Record<string, unknown>) => void } }).snap.pay(data.token, {
          onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription'] }) },
          onPending: () => { /* user can check status later */ },
          onError: () => { /* Snap already shows error UI */ },
          onClose: () => { /* user closed — no action needed, key already cleared */ },
        })
      } catch {
        /* transient — key already cleared, user can upgrade manually */
      }
    }

    void fireSnap()
  }, [queryClient])

  if (!subLoading && sub !== undefined && !sub?.planSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4EBE1' }}>
        <div className="text-center max-w-sm px-4">
          <p className="text-sm text-zinc-500 mb-4">No active plan found. Please contact support.</p>
          <a href="mailto:support@etalas.ai" className="text-sm font-semibold underline" style={{ color: '#f91814' }}>
            support@etalas.ai
          </a>
        </div>
      </div>
    )
  }

  const refresh = () => setConversations(getConversations())

  useEffect(() => {
    void loadConversations().then(setConversations).catch(() => {})
  }, [])

  const handleSuccess = (t: LocalConversation) => {
    refresh()
    usageQuery.invalidate()
    setChatState({ prompt: t.summary, conversationId: t.id, autoRun: true })
  }

  const handleDelete = (id: string) => {
    deleteLocalConversation(id)
    if (chatState?.conversationId === id) setChatState(null)
    refresh()
    setSelected(null)
  }

  const currentConversation = conversations.find(t => t.id === chatState?.conversationId) ?? null

  useEffect(() => {
    setShowChatMenu(false)
    setRenamingTitle(false)
    setConfirmDeleteChat(false)
    if (chatState) {
      localStorage.setItem('sandwich_last_chat', JSON.stringify({ prompt: chatState.prompt, conversationId: chatState.conversationId }))
    } else {
      localStorage.removeItem('sandwich_last_chat')
    }
  }, [chatState?.conversationId])

  const toggleChatPin = () => {
    if (!currentConversation) return
    updateLocalConversation(currentConversation.id, { pinned: !currentConversation.pinned })
    refresh()
    setShowChatMenu(false)
  }

  const toggleChatUnread = () => {
    if (!currentConversation) return
    updateLocalConversation(currentConversation.id, { unread: !currentConversation.unread })
    refresh()
    setShowChatMenu(false)
  }

  const startChatRename = () => {
    if (!currentConversation) return
    setRenameValue(currentConversation.summary)
    setRenamingTitle(true)
    setShowChatMenu(false)
  }

  const commitChatRename = () => {
    if (currentConversation) {
      const value = renameValue.trim()
      if (value && value !== currentConversation.summary) {
        updateLocalConversation(currentConversation.id, { summary: value })
        setChatState(prev => (prev ? { ...prev, prompt: value } : prev))
        refresh()
      }
    }
    setRenamingTitle(false)
  }

  const handleChatPromptUpdate = (text: string) => {
    if (!currentConversation) return
    updateLocalConversation(currentConversation.id, { summary: text, description: text })
    setChatState(prev => (prev ? { ...prev, prompt: text } : prev))
    refresh()
  }

  const handleDeleteChat = () => {
    setShowChatMenu(false)
    setConfirmDeleteChat(true)
  }

  const confirmDeleteChatNow = () => {
    if (!currentConversation) return
    deleteLocalConversation(currentConversation.id)
    refresh()
    setChatState(null)
    setConfirmDeleteChat(false)
  }

  const notifications = conversations.filter(t => t.status === 'done' && t.unread)

  const openNotification = (t: LocalConversation) => {
    setShowNotifMenu(false)
    updateLocalConversation(t.id, { unread: false })
    refresh()
    setChatState({ prompt: t.summary, conversationId: t.id, autoRun: false })
    setActiveNav('home')
  }

  const openShareModal = () => {
    if (!currentConversation) return
    setShowMoreMenu(false)
    setShowNotifMenu(false)
    setShareVisibility('private')
    setShowShareModal(true)
  }

  const handleCreateShareLink = async () => {
    if (!currentConversation) return
    let url: string
    if (shareVisibility === 'shared') {
      const { url: sharePath } = await shareConversation(currentConversation.id)
      url = `${window.location.origin}${sharePath}`
    } else {
      await unshareConversation(currentConversation.id).catch(() => {})
      url = `${window.location.origin}/dashboard`
    }
    void navigator.clipboard.writeText(url)
    setShowShareModal(false)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 1500)
  }

  const byType = (type: ConversationType) => conversations.filter(t => t.type === type)
  const isHomePage = activeNav === 'home'

  const renderPage = () => {
    if (activeNav === 'settings') return <Settings />
    if (activeNav === 'help') return <HelpPage />
    if (activeNav === 'documents') return <DocumentsPanel onOpenDocument={setOpenDocumentId} />

    if (activeNav === 'briefs') return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>MY BRIEFS</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{conversations.length} {tr('dash_docs_saved')}</p>
          </div>
          <ConversationList conversations={conversations} onOpen={(t) => setChatState({ prompt: t.summary, conversationId: t.id, autoRun: false })} onNew={() => setActiveNav('home')} />
        </div>
      </div>
    )

    return null
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
              const count = byType(PIPELINE_MAP[item.id]?.type ?? 'general' as ConversationType).length
              return (
                <button key={item.id} onClick={() => { setActiveNav(item.id); setChatState(null); if (window.innerWidth < 768) setSidebarOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left mb-0.5"
                  style={isActive ? { backgroundColor: '#f91814', color: '#ffffff', fontWeight: 500 } : { color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
                >
                  <iconify-icon icon={item.icon} width="15" />
                  {item.label}
                  {item.id !== 'documents' && count > 0 && (
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
            {conversations.length === 0 ? (
              <p className="px-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{tr('dash_no_chats')}</p>
            ) : (
              conversations.slice().reverse().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).map(t => {
                const meta = TYPE_META[t.type] ?? TYPE_META.general
                const isActive = chatState?.conversationId === t.id
                const menuOpen = contextMenuConversation === t.id
                const isRenaming = renamingConversationId === t.id
                return (
                  <div key={t.id} className="relative group/item mb-0.5">
                    <button
                      onClick={() => {
                        setChatState({ prompt: t.summary, conversationId: t.id, autoRun: false })
                        if (t.unread) updateLocalConversation(t.id, { unread: false })
                        refresh()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                      style={{ backgroundColor: isActive || menuOpen ? 'rgba(255,255,255,0.08)' : '' }}
                      onMouseEnter={e => { if (!isActive && !menuOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { if (!isActive && !menuOpen) e.currentTarget.style.backgroundColor = '' }}
                    >
                      <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center" style={{ backgroundColor: meta.color }}>
                        <iconify-icon icon={meta.icon} width="11" style={{ color: meta.ic }} />
                      </div>
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameConversationValue}
                          onChange={e => setRenameConversationValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              updateLocalConversation(t.id, { summary: renameConversationValue }); refresh()
                              setRenamingConversationId(null)
                            }
                            if (e.key === 'Escape') setRenamingConversationId(null)
                          }}
                          onBlur={() => {
                            if (renameConversationValue.trim()) { updateLocalConversation(t.id, { summary: renameConversationValue }); refresh() }
                            setRenamingConversationId(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 bg-transparent outline-none text-xs min-w-0"
                          style={{ color: '#ffffff' }}
                        />
                      ) : (
                        <span className="text-xs truncate flex-1" style={{ color: isActive ? '#ffffff' : t.unread ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: t.unread ? 600 : 400 }}>{t.summary}</span>
                      )}
                      {t.pinned && !menuOpen && (
                        <iconify-icon icon="solar:pin-bold" width="10" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                      )}
                      {t.unread && !menuOpen && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f91814' }} />
                      )}
                    </button>
                    {/* Three dots button — visible on row hover or when menu open */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setContextMenuConversation(menuOpen ? null : t.id)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                      style={{ opacity: menuOpen ? 1 : undefined, color: 'rgba(255,255,255,0.5)' }}
                    >
                      <iconify-icon icon="solar:menu-dots-bold" width="14" />
                    </button>
                    {/* Context menu */}
                    {menuOpen && (
                      <>
                      <div className="fixed inset-0 z-40" onClick={() => setContextMenuConversation(null)} />
                      <div
                        className="absolute right-0 top-full mt-0.5 z-50 rounded-xl py-1 min-w-[160px] shadow-xl"
                        style={{ backgroundColor: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button onClick={() => { updateLocalConversation(t.id, { pinned: !t.pinned }); setContextMenuConversation(null); refresh() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                          style={{ color: 'rgba(255,255,255,0.85)' }}>
                          <iconify-icon icon="solar:pin-linear" width="14" />
                          {t.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button onClick={() => { updateLocalConversation(t.id, { unread: !t.unread }); setContextMenuConversation(null); refresh() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                          style={{ color: 'rgba(255,255,255,0.85)' }}>
                          <iconify-icon icon="solar:eye-closed-linear" width="14" />
                          {t.unread ? 'Mark as read' : 'Mark as unread'}
                        </button>
                        <button onClick={() => { setRenameConversationValue(t.summary); setRenamingConversationId(t.id); setContextMenuConversation(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                          style={{ color: 'rgba(255,255,255,0.85)' }}>
                          <iconify-icon icon="solar:pen-2-linear" width="14" />
                          Rename
                        </button>
                        <button onClick={() => { handleDelete(t.id); setContextMenuConversation(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                          style={{ color: '#f91814' }}>
                          <iconify-icon icon="solar:trash-bin-trash-linear" width="14" />
                          Delete
                        </button>
                      </div>
                      </>
                    )}
                  </div>
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
              <div className="absolute bottom-16 left-3 right-3 rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', animation: 'slideUp 0.15s ease-out' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-sm font-semibold text-white">{username}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{email}</p>
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
                  <p className="text-sm font-medium min-w-0 truncate" style={{ color: 'rgba(0,0,0,0.6)' }}>
                    {chatState.prompt.split(/\s+/).slice(0, 4).join(' ')}{chatState.prompt.split(/\s+/).length > 4 ? '...' : ''}
                  </p>
                )}
                <div className="relative shrink-0 flex items-center">
                  <button onClick={() => setShowChatMenu(v => !v)} className="p-1 rounded-md hover:bg-black/5 transition-colors flex items-center justify-center shrink-0">
                    <iconify-icon icon="solar:alt-arrow-down-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)', display: 'block' }} />
                  </button>
                  {showChatMenu && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setShowChatMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-[101] w-48 rounded-xl overflow-hidden"
                        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="p-1.5">
                          <button onClick={toggleChatPin}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon={currentConversation?.pinned ? 'solar:pin-bold' : 'solar:pin-linear'} width="15" />
                            {currentConversation?.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={toggleChatUnread}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                            <iconify-icon icon={currentConversation?.unread ? 'solar:eye-linear' : 'solar:eye-closed-linear'} width="15" />
                            {currentConversation?.unread ? 'Mark as read' : 'Mark as unread'}
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
              <div className="relative hidden">
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
              <button onClick={openShareModal} className="p-2 rounded-lg hover:bg-black/5 transition-colors hidden" title="Share chat">
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
              conversationId={chatState.conversationId}
              createdAt={currentConversation?.createdAt ?? new Date().toISOString()}
              autoRun={chatState.autoRun}
              onPromptUpdate={handleChatPromptUpdate}
              onOpenDocument={setOpenDocumentId}
            />
          </div>
        ) : isHomePage ? (
          <HomeOverview
            conversations={conversations}
            username={username}
            usage={usage}
            onSuccess={handleSuccess}
            onOpenConversation={(t) => setChatState({ prompt: t.summary, conversationId: t.id, autoRun: false })}
            onGoTemplates={() => setActiveNav('documents')}
            onGoBriefs={() => setActiveNav('briefs')}
            onGoType={() => setActiveNav('home')}
          />
        ) : renderPage()}
      </main>


      {selected && <Drawer conversation={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}

      <DocumentReaderPanel documentId={openDocumentId} onClose={() => setOpenDocumentId(null)} />

      <ConfirmDeleteModal
        open={confirmDeleteChat}
        title="Delete Chat"
        message={`Are you sure you want to delete "${currentConversation?.summary ?? ''}"?`}
        onConfirm={confirmDeleteChatNow}
        onClose={() => setConfirmDeleteChat(false)}
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
