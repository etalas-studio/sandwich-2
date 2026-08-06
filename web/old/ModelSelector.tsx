import { useIntegrations } from '../hooks/useIntegrations'
import { useModelContext } from '../contexts/ModelContext'

export default function ModelSelector({ scope }: { scope: string }) {
  const { integrations, isLoading } = useIntegrations()
  const { selectedModelId, setSelectedModelId } = useModelContext(scope)

  // Collect models only from connected providers
  const connectedModels = integrations
    .filter((i) => i.connected && i.models.length > 0)
    .flatMap((i) =>
      i.models.map((m) => ({
        ...m,
        providerId: i.id,
        providerName: i.name,
      })),
    )

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedModelId(value || null)
  }

  if (isLoading) {
    return (
      <div className="h-8 w-40 rounded-lg bg-white/[0.03] animate-pulse" />
    )
  }

  if (connectedModels.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <select
        value={selectedModelId ?? ''}
        onChange={handleChange}
        className="appearance-none bg-[#0a0a0a] border border-white/[0.05] rounded-lg pl-3 pr-8 py-1.5 text-xs text-white/70 outline-none focus:border-white/10 transition-colors font-light cursor-pointer"
        style={{
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        <option value="" className="bg-[#0a0a0a] text-white/40">
          Select model…
        </option>
        {integrations
          .filter((i) => i.connected && i.models.length > 0)
          .map((provider) => (
            <optgroup
              key={provider.id}
              label={provider.name}
              className="text-white/30 text-[10px]"
            >
              {provider.models.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-[#0a0a0a] text-white/70"
                >
                  {m.name || m.id}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
      {/* Custom chevron */}
      <iconify-icon
        icon="solar:alt-arrow-down-linear"
        width="12"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
      />
    </div>
  )
}
