import { useEffect, useState, useCallback } from 'react'
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
  updatedAt: string
}

const TYPE_LABEL: Record<string, string> = {
  prd: 'PRD',
  quotation: 'Quotation',
  prototype: 'Prototype',
  specs: 'Specs',
}

function PrototypeCard({ doc, onChanged, onOpenDocument }: { doc: DocumentItem; onChanged: () => void; onOpenDocument: (id: string) => void }) {
  const latest = doc.latestVersionNo ?? 1
  const current = doc.currentVersionNo ?? latest
  const [version, setVersion] = useState(current)
  const [setting, setSetting] = useState(false)
  const base = doc.previewUrl?.replace(/\/$/, '') ?? ''
  const previewUrl = base ? `${base}/v/${version}/` : null

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
    <div className="flex flex-col gap-2 p-5 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
      <button onClick={() => onOpenDocument(doc.id)} className="text-left group">
        <span className="text-xs font-semibold uppercase" style={{ color: '#f91814' }}>Prototype</span>
        <span className="block font-semibold truncate mt-1" style={{ color: '#111827' }}>{doc.title}</span>
        <span className="inline-flex items-center gap-1 text-xs mt-1.5 text-blue-600">
          <iconify-icon icon="solar:eye-linear" width="12" />
          Preview &amp; Download
        </span>
      </button>
      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: '#2563eb' }}>
            Open preview
          </a>
        )}
        <select
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
          className="text-xs px-2 py-1 rounded border"
          style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827' }}
        >
          {Array.from({ length: latest }, (_, i) => latest - i).map((v) => (
            <option key={v} value={v}>v{v}{v === current ? ' (current)' : ''}</option>
          ))}
        </select>
        {version !== current && (
          <button
            onClick={() => void setCurrent()}
            disabled={setting}
            className="text-xs px-2 py-1 rounded border"
            style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827', opacity: setting ? 0.5 : 1 }}
          >
            {setting ? 'Setting…' : 'Set as current'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function DocumentsPanel({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
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
                <PrototypeCard key={d.id} doc={d} onChanged={load} onOpenDocument={onOpenDocument} />
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
