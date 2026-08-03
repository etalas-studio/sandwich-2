import { useCallback, useEffect, useState } from 'react'
import { fetchIntegrations, connectIntegration, disconnectIntegration } from '../types'
import type { IntegrationItem } from '../types'
import ConnectModal from './ConnectModal'

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

const PROVIDERS = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    logo: 'solar:bolt-circle-linear',
    description:
      'Premium tier with DeepSeek V4, Kimi K3, Qwen3.7, MiniMax-M3, Grok 4.5, and more. Get your key at opencode.ai.',
    docsUrl: 'https://opencode.ai',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    logo: 'solar:stars-minimalistic-linear',
    description:
      'Requires ChatGPT Plus or Pro subscription. Login via Pi CLI to connect your Codex subscription for GPT-5.5.',
    docsUrl: 'https://github.com/openai/codex',
  },
  {
    id: '9router',
    name: '9Router',
    logo: 'solar:globus-linear',
    description:
      'Intelligent AI request router — automatically selects the best model across providers based on cost, latency, and capability.',
    docsUrl: 'https://9router.com',
  },
] as const

export default function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([])
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchIntegrations()
      setIntegrations(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations')
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = async (providerId: string, key: string) => {
    setConnectingId(providerId)
    setError(null)

    const result = await connectIntegration(providerId, key)

    if (result.ok) {
      setModalOpen(false)
      await loadStatus()
    } else {
      setError(result.message)
    }

    setConnectingId(null)
  }

  const handleDisconnect = async (providerId: string) => {
    setConnectingId(providerId)
    setError(null)

    const result = await disconnectIntegration(providerId)
    await loadStatus()

    if (!result.ok) setError(result.message)
    setConnectingId(null)
  }

  const getIntegration = (providerId: string): IntegrationItem | undefined =>
    integrations.find((i) => i.id === providerId)

  const getState = (providerId: string): ConnectionState => {
    if (connectingId === providerId) return 'connecting'
    const integration = getIntegration(providerId)
    if (!integration) return 'disconnected'
    if (integration.connected) return 'connected'
    return 'disconnected'
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
            Integrations
          </h1>
          <span className="px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/50">
            integrations
          </span>
        </div>
        <p className="text-sm text-white/50 font-light max-w-xl">
          Connect AI coding engines through Pi SDK to route agent tasks.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="ds-card-outer mb-6">
          <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
            <p className="text-sm text-[#ff8a8a]">{error}</p>
          </div>
        </div>
      )}

      {/* Provider cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PROVIDERS.map((provider) => {
          const state = getState(provider.id)
          const integration = getIntegration(provider.id)
          const models = integration?.models ?? []
          const isOAuth = integration?.authType === 'oauth'

          return (
            <div key={provider.id} className="ds-card-outer">
              <div className="ds-card-inner p-5">
                <div className="absolute inset-0 ds-noise pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">

                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-lg bg-gradient-to-b from-[#2a2a2a] to-[#161616] flex items-center justify-center border border-white/[0.06] shrink-0"
                        style={{
                          boxShadow:
                            'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.6)',
                        }}
                      >
                        <iconify-icon
                          icon={provider.logo}
                          width="18"
                          className={state === 'connected' ? 'text-emerald-400' : 'text-white/60'}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-normal text-white ds-text-shadow truncate">
                          {provider.name}
                        </h3>
                      </div>
                    </div>

                    {/* Status dot */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOAuth && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-normal border border-purple-500/20 bg-purple-500/[0.06] text-purple-400">
                          OAuth
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          state === 'connected'
                            ? 'bg-emerald-400 animate-pulse'
                            : state === 'connecting'
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-white/20'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-white/50 font-light leading-relaxed mb-3 flex-1">
                    {provider.description}
                  </p>

                  {/* Connect button (OpenCode Go — disconnected) */}
                  {!isOAuth && state !== 'connected' && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        disabled={state === 'connecting'}
                        className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                        <span
                          className="relative px-3 py-1 rounded-md text-[11px] font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                          style={{
                            boxShadow:
                              'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                          }}
                        >
                          {state === 'connecting' ? (
                            <>
                              <iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />
                              Connecting…
                            </>
                          ) : (
                            'Connect'
                          )}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* OAuth instructions (Codex only) */}
                  {isOAuth && state !== 'connected' && (
                    <div className="mb-3 p-2.5 rounded-lg border border-purple-500/10 bg-purple-500/[0.03]">
                      <p className="text-[10px] text-purple-300/70 font-light leading-relaxed">
                        Run <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">pi --login codex</code> in your terminal.
                        Requires ChatGPT Plus/Pro.
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  {state === 'connected' && !isOAuth && (
                    <div className="pt-3 border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleDisconnect(provider.id)}
                        disabled={connectingId === provider.id}
                        className="relative inline-flex group disabled:opacity-50"
                      >
                        <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                        <span
                          className="relative px-3 py-1 rounded-md text-[10px] font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                          style={{
                            boxShadow:
                              'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)',
                          }}
                        >
                          Disconnect
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Connected details */}
                  {state === 'connected' && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">

                      {models.length > 0 && (
                        <div className="flex items-center gap-1 overflow-hidden">
                          {models.slice(0, 3).map((m) => (
                            <span
                              key={m.id}
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-light text-white/60 bg-white/[0.04] border border-white/[0.06] shrink-0"
                            >
                              {m.id}
                            </span>
                          ))}
                          {models.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-light text-white/40 bg-white/[0.04] border border-white/[0.06] shrink-0">
                              +{models.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Connect modal */}
      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        provider={PROVIDERS[0]}
        connecting={connectingId === PROVIDERS[0].id}
        error={error}
        onConnect={(key) => handleConnect(PROVIDERS[0].id, key)}
      />
    </div>
  )
}
