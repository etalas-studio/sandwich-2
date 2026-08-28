import { useEffect, useState, useCallback } from 'react'
import { Select } from '@base-ui/react'
import { apiUrl } from '../api/base'

const bowlby = "'Bowlby One', system-ui"

interface DocumentItem {
  id: string
  type: string
  title: string
  currentVersionId: string | null
  latestVersionNo: number | null
  currentVersionNo: number | null
  previewUrl: string | null
  conversationId: string | null
  createdAt?: string
  updatedAt: string
}

const TYPE_LABEL: Record<string, string> = {
  prd: 'PRD',
  quotation: 'Quotation',
  prototype: 'Prototype',
  specs: 'Specs',
}

function truncateWords(text: string, n: number) {
  const words = text.split(/\s+/)
  return words.length <= n ? text : words.slice(0, n).join(' ') + '…'
}

// ponytail: no global stylesheet; inline styles only
const selectStyles = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 20,
    border: '1.5px solid rgba(0,0,0,0.15)',
    backgroundColor: '#ffffff', color: '#111827',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    outline: 'none', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  popup: {
    backgroundColor: '#ffffff', borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.1)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    padding: '4px', minWidth: 140, zIndex: 50,
  } as React.CSSProperties,
  item: (highlighted: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 8, fontSize: 13,
    cursor: 'pointer', color: '#111827',
    backgroundColor: highlighted ? 'rgba(0,0,0,0.05)' : 'transparent',
  }),
}

function PrototypeCard({ doc, onChanged, onOpenConversation }: { doc: DocumentItem; onChanged: () => void; onOpenConversation: (conversationId: string | null, docTitle: string) => void; onOpenDocument: (id: string) => void }) {
  const latest = doc.latestVersionNo ?? 1
  const current = doc.currentVersionNo ?? latest
  const [version, setVersion] = useState(current)
  const [setting, setSetting] = useState(false)
  const base = (doc.previewUrl ?? apiUrl(`/p/${doc.id}`)).replace(/\/$/, '')
  const previewUrl = `${base}/v/${version}/`

  const dateStr = new Date(doc.createdAt ?? doc.updatedAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const setCurrent = async () => {
    setSetting(true)
    try {
      await fetch(apiUrl(`/api/documents/${doc.id}/rollback`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionNo: version }),
      })
      onChanged()
    } finally {
      setSetting(false)
    }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
      style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
      onClick={() => onOpenConversation(doc.conversationId, doc.title)}
    >
      {/* Preview thumbnail */}
      <div style={{ height: 180, overflow: 'hidden', position: 'relative', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
        {doc.latestVersionNo ? (
          <iframe
            src={previewUrl}
            title="preview"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '400%', height: '720px',
              transform: 'scale(0.25)', transformOrigin: 'top left',
              border: 'none', pointerEvents: 'none',
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <iconify-icon icon="solar:widget-linear" width="36" style={{ color: 'rgba(0,0,0,0.15)' }} />
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold leading-snug" style={{ color: '#111827' }}>
            {truncateWords(doc.title, 4)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{dateStr}</p>
        </div>

        {/* Preview button + version select */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {doc.latestVersionNo && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 24,
                backgroundColor: '#111827', color: '#ffffff',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <iconify-icon icon="solar:eye-bold" width="14" />
              Preview
            </a>
          )}
          <Select.Root
            value={String(version)}
            onValueChange={(v) => {
              setVersion(Number(v))
            }}
          >
            <Select.Trigger style={{ ...selectStyles.trigger, marginLeft: 'auto' }}>
              <Select.Value>{`v${version}${version === current ? ' (current)' : ''}`}</Select.Value>
              <iconify-icon icon="solar:alt-arrow-down-linear" width="12" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={6}>
                <Select.Popup style={selectStyles.popup}>
                  {Array.from({ length: latest }, (_, i) => latest - i).map((v) => (
                    <Select.Item
                      key={v}
                      value={String(v)}
                      style={selectStyles.item(false)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.05)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                    >
                      <Select.ItemText>v{v}{v === current ? ' (current)' : ''}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          {version !== current && (
            <button
              onClick={() => void setCurrent()}
              disabled={setting}
              style={{
                padding: '8px 12px', borderRadius: 20,
                border: '1.5px solid rgba(0,0,0,0.15)',
                backgroundColor: '#ffffff', color: '#374151',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                opacity: setting ? 0.5 : 1, flexShrink: 0,
              }}
            >
              {setting ? 'Setting…' : 'Set current'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPanel({ onOpenDocument, onOpenConversation }: { onOpenDocument: (id: string) => void; onOpenConversation?: (conversationId: string | null, docTitle: string) => void }) {
  const [items, setItems] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(apiUrl('/api/documents'), { credentials: 'include' })
      .then((r) => r.json())
      .then((list: DocumentItem[]) => { setItems(list); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl tracking-tighter mb-6" style={{ color: '#111827', fontFamily: bowlby }}>
          DOCUMENTS
        </h1>

        {loading ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            No documents yet. Start a chat and ask SANDWICH to generate one.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.slice().reverse().map((d) => (
              d.type === 'prototype' ? (
                <PrototypeCard key={d.id} doc={d} onChanged={load} onOpenConversation={onOpenConversation ?? ((_, _t) => onOpenDocument(d.id))} onOpenDocument={onOpenDocument} />
              ) : (
                <button
                  key={d.id}
                  onClick={() => onOpenDocument(d.id)}
                  className="flex flex-col gap-2 p-5 rounded-2xl border text-left group"
                  style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
                >
                  <span className="text-xs font-semibold uppercase" style={{ color: '#f91814' }}>
                    {TYPE_LABEL[d.type] ?? d.type}
                  </span>
                  <span className="font-semibold truncate" style={{ color: '#111827' }}>{d.title}</span>
                  {d.latestVersionNo != null && (
                    <span className="text-xs" style={{ color: '#9ca3af' }}>v{d.latestVersionNo}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                    <iconify-icon icon="solar:eye-linear" width="12" />
                    Preview &amp; Download
                  </span>
                  <a
                    href={apiUrl(`/api/documents/${d.id}/export?format=md`)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs underline"
                    style={{ color: '#2563eb' }}
                  >
                    Download MD
                  </a>
                </button>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
