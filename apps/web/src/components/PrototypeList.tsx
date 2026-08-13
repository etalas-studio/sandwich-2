import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api/base'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

interface PrototypeItem {
  id: string
  shareId: string
  name: string
  brief: string
  status: string
  createdAt: string
  previewUrl?: string
}

export default function PrototypeList() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState<PrototypeItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(apiUrl('/api/prototypes'), { credentials: 'include' })
      .then((r) => r.json())
      .then((list: PrototypeItem[]) => { setItems(list); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const statusColor = (s: string) => (s === 'done' ? '#16a34a' : s === 'failed' ? '#dc2626' : '#b45309')

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl tracking-tighter" style={{ color: '#111827', fontFamily: bowlby }}>PROTOTYPES</h1>
            <p className="text-sm mt-0.5" style={{ color: '#9ca3af' }}>{items.length} {tr('dash_prototypes_saved')}</p>
          </div>
          <button
            onClick={() => navigate('/prototype')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f91814', color: '#ffffff' }}
          >
            <iconify-icon icon="solar:add-circle-linear" width="15" />
            {tr('dash_new_prototype')}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: '#9ca3af' }}>Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: '#9ca3af' }}>No prototypes yet.</p>
            <button
              onClick={() => navigate('/prototype')}
              className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#111827' }}
            >
              {tr('dash_new_prototype')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.slice().reverse().map((p) => (
              <button
                key={p.id}
                onClick={() => { if (p.previewUrl) window.open(p.previewUrl, '_blank', 'noopener') }}
                className="flex flex-col gap-3 p-5 rounded-2xl text-left border transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
              >
                <span className="font-semibold truncate" style={{ color: '#111827' }}>{p.name}</span>
                <span className="text-xs inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(p.status) }} />
                  <span style={{ color: statusColor(p.status) }}>{p.status}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
