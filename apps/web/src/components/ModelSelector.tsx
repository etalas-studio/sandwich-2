import { useEffect, useState, useRef } from 'react'
import { useIntegrations } from '../hooks/useIntegrations'
import { useModelContext } from '../contexts/ModelContext'

export default function ModelSelector({ scope }: { scope: string }) {
  const { integrations, isLoading } = useIntegrations()
  const { selectedModelId, setSelectedModelId } = useModelContext(scope)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const connectedModels = integrations
    .filter((i) => i.connected && i.models.length > 0)
    .flatMap((i) => i.models.map((m) => ({ ...m, providerName: i.name })))

  useEffect(() => {
    if (!selectedModelId && connectedModels.length > 0) {
      const preferred = connectedModels.find(m => m.id === 'opencode-go/minimax-m3')
      setSelectedModelId(preferred?.id ?? connectedModels[0].id)
    }
  }, [connectedModels.length])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (isLoading || connectedModels.length === 0) return null

  const active = connectedModels.find(m => m.id === selectedModelId) ?? connectedModels[0]
  const label = active.name || active.id

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 transition-colors"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        <span className="text-[11px] font-medium max-w-[80px] truncate">{label}</span>
        <iconify-icon icon="solar:alt-arrow-down-linear" width="10" />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 rounded-xl z-50 min-w-[180px]"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          <div className="overflow-y-auto py-1" style={{ maxHeight: '220px' }}>
            {integrations.filter(i => i.connected && i.models.length > 0).map(provider => (
              <div key={provider.id}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest sticky top-0" style={{ color: 'rgba(255,255,255,0.25)', backgroundColor: '#1a1a1a' }}>
                  {provider.name}
                </p>
                {provider.models.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedModelId(m.id); setOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{
                      color: m.id === (selectedModelId ?? connectedModels[0].id) ? '#ffffff' : 'rgba(255,255,255,0.55)',
                      backgroundColor: m.id === (selectedModelId ?? connectedModels[0].id) ? 'rgba(249,24,20,0.12)' : 'transparent',
                    }}
                  >
                    {m.name || m.id}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
