import { useEffect, useState, useCallback } from 'react'
import { apiUrl } from '../api/base'

const bowlby = "'Bowlby One', system-ui"

interface DocumentItem {
  id: string
  type: string
  title: string
  currentVersionId: string | null
  previewUrl: string | null
  updatedAt: string
}

const TYPE_LABEL: Record<string, string> = {
  prd: 'PRD',
  quotation: 'Quotation',
  prototype: 'Prototype',
  specs: 'Specs',
}

export default function DocumentsPanel() {
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
              <div key={d.id} className="flex flex-col gap-2 p-5 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
                <span className="text-xs font-semibold uppercase" style={{ color: '#f91814' }}>
                  {TYPE_LABEL[d.type] ?? d.type}
                </span>
                <span className="font-semibold truncate" style={{ color: '#111827' }}>{d.title}</span>
                {d.previewUrl && (
                  <a href={d.previewUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: '#2563eb' }}>
                    Preview
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
