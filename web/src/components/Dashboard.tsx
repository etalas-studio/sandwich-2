import { useState, useRef, useCallback } from 'react'
import { getTickets, saveTicket, deleteTicket, type LocalTicket, type TicketType } from '../lib/localTickets'
import { createTicket } from '../api/tickets'

interface AttachedFile { name: string; type: string; dataUrl: string }

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
  { label: 'PRD Lengkap',    type: 'prd'       as TicketType, icon: 'solar:document-add-linear',      prompt: 'Buatkan PRD lengkap untuk ' },
  { label: 'Prototype Brief',type: 'prototype'  as TicketType, icon: 'solar:widget-linear',            prompt: 'Buatkan prototype brief untuk ' },
  { label: 'MOM',            type: 'mom'        as TicketType, icon: 'solar:calendar-linear',          prompt: 'Buatkan MOM (minutes of meeting) untuk ' },
  { label: 'Quotation',      type: 'quotation'  as TicketType, icon: 'solar:dollar-minimalistic-linear',prompt: 'Buatkan quotation untuk ' },
  { label: 'Specs & Task',   type: 'specs'      as TicketType, icon: 'solar:checklist-linear',         prompt: 'Buatkan specs dan task untuk ' },
]

const QUICK_TYPES = [
  { label: 'PRD Lengkap',        type: 'prd'       as TicketType, icon: 'solar:document-add-linear',       color: '#fef3c7', iconColor: '#f97316', prompt: 'Buatkan PRD lengkap untuk ' },
  { label: 'Prototype Brief',    type: 'prototype'  as TicketType, icon: 'solar:widget-linear',             color: '#ede9fe', iconColor: '#7c3aed', prompt: 'Buatkan prototype brief untuk ' },
  { label: 'Workflow Automations',type:'workflow'    as TicketType, icon: 'solar:settings-minimalistic-linear',color:'#dbeafe',iconColor:'#2563eb',  prompt: 'Buatkan workflow automation untuk ' },
  { label: 'MOM Meeting',        type: 'mom'        as TicketType, icon: 'solar:calendar-linear',           color: '#dcfce7', iconColor: '#16a34a', prompt: 'Buatkan MOM (minutes of meeting) untuk ' },
  { label: 'Quotation Brief',    type: 'quotation'  as TicketType, icon: 'solar:dollar-minimalistic-linear',color: '#fce7f3', iconColor: '#db2777', prompt: 'Buatkan quotation untuk ' },
  { label: 'Specs & Task',       type: 'specs'      as TicketType, icon: 'solar:checklist-linear',          color: '#f0fdf4', iconColor: '#15803d', prompt: 'Buatkan specs dan task untuk ' },
]

const TYPE_META: Record<string, { label: string; color: string; ic: string; icon: string }> = {
  prd:       { label: 'PRD',       color: '#fef3c7', ic: '#f97316', icon: 'solar:document-add-linear' },
  mom:       { label: 'MOM',       color: '#dbeafe', ic: '#2563eb', icon: 'solar:calendar-linear' },
  quotation: { label: 'Quotation', color: '#dcfce7', ic: '#16a34a', icon: 'solar:dollar-minimalistic-linear' },
  specs:     { label: 'Specs',     color: '#fce7f3', ic: '#db2777', icon: 'solar:checklist-linear' },
  prototype: { label: 'Prototype', color: '#ede9fe', ic: '#7c3aed', icon: 'solar:widget-linear' },
  workflow:  { label: 'Workflow',  color: '#dbeafe', ic: '#2563eb', icon: 'solar:settings-minimalistic-linear' },
  general:   { label: 'Brief',     color: '#f3f4f6', ic: '#6b7280', icon: 'solar:notes-linear' },
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
function Drawer({ ticket, onClose, onDelete }: { ticket: LocalTicket; onClose: () => void; onDelete: (id: string) => void }) {
  const meta = TYPE_META[ticket.type] ?? TYPE_META.general
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg h-full overflow-y-auto flex flex-col shadow-2xl border-l"
        style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
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

// ── Ticket List ────────────────────────────────────────────────────────────────
function TicketList({ tickets, onOpen, onNew }: { tickets: LocalTicket[]; onOpen: (t: LocalTicket) => void; onNew: () => void }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#f3f4f6' }}>
          <iconify-icon icon="solar:notes-linear" width="22" style={{ color: '#9ca3af' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: '#374151' }}>Belum ada dokumen</p>
        <p className="text-xs mt-1 mb-5" style={{ color: '#9ca3af' }}>Buat yang pertama dari halaman Home</p>
        <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
          <iconify-icon icon="solar:add-linear" width="14" />
          New Brief
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
      {tickets.map(t => {
        const meta = TYPE_META[t.type] ?? TYPE_META.general
        return (
          <button key={t.id} onClick={() => onOpen(t)}
            className="w-full flex items-center justify-between px-5 py-4 text-left border-b last:border-b-0 transition-colors"
            style={{ borderColor: '#f3f4f6' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
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
              }}>{t.status === 'done' ? 'Done' : 'Draft'}</span>
              <iconify-icon icon="solar:arrow-right-linear" width="14" style={{ color: '#d1d5db' }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Dashboard({ onBack }: { onBack: () => void }) {
  const [tickets, setTickets] = useState<LocalTicket[]>(() => getTickets())
  const [selected, setSelected] = useState<LocalTicket | null>(null)
  const [activeNav, setActiveNav] = useState('home')
  const [prompt, setPrompt] = useState('')
  const [activeType, setActiveType] = useState<TicketType>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [activeTab, setActiveTab] = useState<'chat' | 'overview'>('chat')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = () => setTickets(getTickets())

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
      const desc = attachments.map(a => `[attachment: ${a.name}]`).join('\n')
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
      refresh()
      setPrompt('')
      setAttachments([])
      setActiveType('general')
      setSelected(local)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (id: string) => {
    deleteTicket(id)
    refresh()
    setSelected(null)
  }

  const goNewBrief = (type: TicketType = 'general', prefill = '') => {
    setActiveType(type)
    setPrompt(prefill)
    setActiveNav('home')
  }

  const byType = (type: TicketType) => tickets.filter(t => t.type === type)
  const isHomePage = activeNav === 'home'

  const renderPage = () => {
    if (activeNav === 'briefs') return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#111827' }}>My Briefs</h1>
              <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{tickets.length} dokumen tersimpan</p>
            </div>
            <button onClick={() => goNewBrief()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
              <iconify-icon icon="solar:add-linear" width="14" />
              New Brief
            </button>
          </div>
          <TicketList tickets={tickets} onOpen={setSelected} onNew={() => goNewBrief()} />
        </div>
      </div>
    )

    if (activeNav === 'templates') return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Templates</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>Pilih template, langsung buat brief</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_TYPES.map(t => (
              <button key={t.label} onClick={() => goNewBrief(t.type, t.prompt)}
                className="flex items-start gap-4 p-5 rounded-xl border text-left transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
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

    const pipelineMap: Record<string, { type: TicketType; title: string; desc: string; prompt: string }> = {
      prd:       { type: 'prd',       title: 'PRD',           desc: 'Product Requirements Documents',   prompt: 'Buatkan PRD lengkap untuk ' },
      mom:       { type: 'mom',       title: 'MOM / Notulen', desc: 'Minutes of Meeting dan notulensi', prompt: 'Buatkan notulen meeting untuk ' },
      quotation: { type: 'quotation', title: 'Quotation',     desc: 'Estimasi dan kalkulasi proyek',    prompt: 'Buatkan quotation untuk ' },
      specs:     { type: 'specs',     title: 'Specs & Task',  desc: 'Technical specs dan task breakdown',prompt: 'Buatkan specs dan task untuk ' },
    }
    const pp = pipelineMap[activeNav]
    if (!pp) return null
    const filtered = byType(pp.type)

    return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#111827' }}>{pp.title}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{pp.desc} · {filtered.length} dokumen</p>
            </div>
            <button onClick={() => goNewBrief(pp.type, pp.prompt)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#111827', color: '#ffffff' }}>
              <iconify-icon icon="solar:add-linear" width="14" />
              Buat {pp.title}
            </button>
          </div>
          <TicketList tickets={filtered} onOpen={setSelected} onNew={() => goNewBrief(pp.type, pp.prompt)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f9fafb', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col w-56 shrink-0 border-r" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#f91814' }}>
              <span className="text-white font-black text-xs" style={{ fontFamily: "'Bowlby One', sans-serif" }}>S</span>
            </div>
            <span className="font-bold text-sm tracking-wide" style={{ color: '#111827', fontFamily: "'Bowlby One', sans-serif" }}>SANDWICH</span>
          </div>
          <button className="p-1 rounded hover:bg-gray-100 transition-colors">
            <iconify-icon icon="solar:sidebar-minimalistic-linear" width="15" style={{ color: '#9ca3af' }} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
            <iconify-icon icon="solar:magnifer-linear" width="13" style={{ color: '#9ca3af' }} />
            <span className="text-xs flex-1" style={{ color: '#9ca3af' }}>Search...</span>
            <span className="text-[10px] font-mono px-1 rounded" style={{ color: '#9ca3af', backgroundColor: '#e5e7eb' }}>⌘K</span>
          </div>
        </div>

        <nav className="flex-1 px-2 overflow-y-auto">
          {NAV.map((item, i) => {
            if ('section' in item) return (
              <p key={i} className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9ca3af' }}>{item.section}</p>
            )
            const isActive = activeNav === item.id
            const typeMap: Record<string, TicketType> = { prd: 'prd', mom: 'mom', quotation: 'quotation', specs: 'specs' }
            const count = typeMap[item.id!] ? byType(typeMap[item.id!]).length : 0
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id!)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left mb-0.5"
                style={isActive ? { backgroundColor: '#f3f4f6', color: '#111827', fontWeight: 500 } : { color: '#6b7280' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
              >
                <iconify-icon icon={item.icon} width="15" />
                {item.label}
                {count > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t px-2 py-3" style={{ borderColor: '#e5e7eb' }}>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-0.5 transition-colors" style={{ color: '#6b7280' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <iconify-icon icon="solar:question-circle-linear" width="15" />
            Help &amp; Docs
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-2 transition-colors" style={{ color: '#6b7280' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
            <iconify-icon icon="solar:settings-linear" width="15" />
            Settings
          </button>
          <button onClick={onBack} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: '#f3f4f6' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#f91814' }}>S</div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>Sandwich</p>
              <p className="text-[10px] truncate" style={{ color: '#9ca3af' }}>← Kembali</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
          <button onClick={() => goNewBrief()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e5e7eb', color: '#374151' }}>
            <iconify-icon icon="solar:add-linear" width="14" />
            New Brief
          </button>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:lightning-bold" width="12" />
              Upgrade ke PRO
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <iconify-icon icon="solar:bell-linear" width="16" style={{ color: '#6b7280' }} />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <iconify-icon icon="solar:upload-linear" width="16" style={{ color: '#6b7280' }} />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <iconify-icon icon="solar:menu-dots-bold" width="16" style={{ color: '#6b7280' }} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {isHomePage && (
          <div className="flex items-center gap-1 px-6 py-3 border-b shrink-0" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <button onClick={() => setActiveTab('chat')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={activeTab === 'chat' ? { backgroundColor: '#111827', color: '#ffffff' } : { color: '#6b7280' }}>
              Brief Mode
            </button>
            <button onClick={() => setActiveTab('overview')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={activeTab === 'overview' ? { backgroundColor: '#111827', color: '#ffffff' } : { color: '#6b7280' }}>
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

        {/* Page content */}
        {isHomePage ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-12">
            <h1 className="text-4xl font-bold text-center mb-10" style={{ color: '#111827', letterSpacing: '-0.02em', maxWidth: '560px' }}>
              Brief Apa yang Mau Dikerjakan?
            </h1>

            {/* Input box */}
            <div className="w-full max-w-2xl rounded-2xl border mb-8" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff', overflow: 'clip' }}>
              <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b overflow-x-auto" style={{ borderColor: '#f3f4f6', scrollbarWidth: 'none' }}>
                {CHIPS.map(c => (
                  <button key={c.label}
                    onClick={() => { setActiveType(c.type); setPrompt(p => p || c.prompt) }}
                    className="flex shrink-0 items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap"
                    style={{
                      borderColor: activeType === c.type ? '#111827' : '#e5e7eb',
                      color: activeType === c.type ? '#111827' : '#6b7280',
                      backgroundColor: activeType === c.type ? '#f3f4f6' : 'transparent',
                    }}>
                    <iconify-icon icon={c.icon} width="12" />
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSubmit() } }}
                placeholder="Ceritain brief lo di sini..."
                rows={4}
                className="w-full resize-none bg-transparent text-sm outline-none px-4 py-3 leading-relaxed"
                style={{ color: '#111827' }}
              />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {a.type.startsWith('image/') ? <img src={a.dataUrl} className="w-4 h-4 rounded object-cover" alt="" /> : <iconify-icon icon="solar:document-linear" width="12" />}
                      <span className="max-w-[100px] truncate">{a.name}</span>
                      <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="opacity-40 hover:opacity-100">
                        <iconify-icon icon="solar:close-circle-bold" width="12" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: '#f3f4f6' }}>
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-gray-100 transition-colors" style={{ color: '#6b7280' }}>
                    <iconify-icon icon="solar:paperclip-linear" width="14" />
                  </button>
                  <button className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-gray-100 transition-colors" style={{ color: '#6b7280' }}>
                    <iconify-icon icon="solar:microphone-linear" width="14" />
                  </button>
                </div>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !prompt.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                  style={{ backgroundColor: prompt.trim() ? '#111827' : '#e5e7eb' }}
                >
                  <iconify-icon icon="solar:plain-2-linear" width="16" style={{ color: prompt.trim() ? '#ffffff' : '#9ca3af' }} />
                </button>
              </div>
            </div>

            {error && <p className="mb-4 text-xs" style={{ color: '#f91814' }}>{error}</p>}

            {/* Quick type cards */}
            <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-10">
              {QUICK_TYPES.map(qt => (
                <button key={qt.label} onClick={() => goNewBrief(qt.type, qt.prompt)}
                  className="flex flex-col items-start p-4 rounded-xl border text-left transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: qt.color }}>
                    <iconify-icon icon={qt.icon} width="18" style={{ color: qt.iconColor }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>{qt.label}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>Buat brief →</p>
                </button>
              ))}
            </div>

            {/* Recent */}
            {tickets.length > 0 && (
              <div className="w-full max-w-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <iconify-icon icon="solar:history-linear" width="14" style={{ color: '#9ca3af' }} />
                    <p className="text-sm font-semibold" style={{ color: '#374151' }}>Brief Terbaru</p>
                  </div>
                  <button onClick={() => setActiveNav('briefs')} className="text-xs" style={{ color: '#6b7280' }}>Lihat semua →</button>
                </div>
                <TicketList tickets={tickets.slice(0, 5)} onOpen={setSelected} onNew={() => goNewBrief()} />
              </div>
            )}
          </div>
        ) : renderPage()}
      </main>

      {selected && <Drawer ticket={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}
    </div>
  )
}
