import { useState } from 'react'
import { useIntegrations } from '../hooks/useIntegrations'
import type { IntegrationItem } from '../api/integrations'
import { apiUrl } from '../api/base'
import ConnectModal from './ConnectModal'

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

const PROVIDERS = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    logo: '/logos/opencode-logo.png',
    description: 'Premium models — DeepSeek V4, Kimi K3, Qwen3.7, Grok 4.5, and more.',
    docsUrl: 'https://opencode.ai',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    logo: '/logos/claude-logo.png',
    description: 'Claude models direct from Anthropic — Opus, Sonnet, Haiku, Fable.',
    docsUrl: 'https://console.anthropic.com',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    logo: '/logos/codex-logo.png',
    description: 'GPT-5.x Codex models via ChatGPT Plus/Pro subscription.',
    docsUrl: 'https://github.com/openai/codex',
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: 'simple-icons:groq',
    description: 'Fast inference for SANDWICH and getokui document generation — Qwen3, Llama, and more.',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: '9router',
    name: '9Router',
    logo: '/logos/9router-logo.png',
    description: 'Intelligent router — auto-selects best model by cost and latency.',
    docsUrl: 'https://9router.com',
    disabled: true,
  },
  {
    id: 'jira',
    name: 'Jira',
    logo: 'simple-icons:jira',
    description: 'Pull tickets from your Jira project via OAuth 2.0.',
    docsUrl: 'https://developer.atlassian.com/console/myapps/',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    logo: 'simple-icons:bitbucket',
    description: 'Connect your Bitbucket workspace via OAuth 2.0.',
    docsUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/',
  },
  {
    id: 'github',
    name: 'GitHub',
    logo: 'simple-icons:github',
    description: 'Connect your GitHub account to pick a repo and open PRs via OAuth 2.0.',
    docsUrl: 'https://github.com/settings/developers',
  },
] as const

export default function Integrations() {
  const { integrations, isLoading, error, connect, disconnect, connectingId } = useIntegrations()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

  const handleConnect = async (providerId: string, key: string) => {
    await connect(providerId, key)
    setModalOpen(false)
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

  if (isLoading) return <div className="ds-bg min-h-screen" />

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">Integrations</h1>
          <span className="px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/50">integrations</span>
        </div>
        <p className="text-sm text-white/50 font-light max-w-xl">Connect AI coding engines through Pi SDK to route agent tasks.</p>
      </div>

      {error && (
        <div className="ds-card-outer mb-6">
          <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]"><p className="text-sm text-[#ff8a8a]">{error}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((provider) => {
          const state = getState(provider.id)
          const integration = getIntegration(provider.id)
          const models = integration?.models ?? []
          const isOAuth = integration?.authType === 'oauth'
          const jiraProvider = provider.id === 'jira'
          const bbProvider = provider.id === 'bitbucket'
          const ghProvider = provider.id === 'github'
          const isVcsOAuth = jiraProvider || bbProvider || ghProvider
          const isAtlassianOAuth = isVcsOAuth
          const isEngine = ['opencode-go', 'anthropic', 'openai-codex', '9router'].includes(provider.id)
          const is9router = provider.id === '9router'
          const isAnthropic = provider.id === 'anthropic'
          const isOpencode = provider.id === 'opencode-go'
          const isCodex = provider.id === 'openai-codex'
          const isDisabled = 'disabled' in provider && provider.disabled

          return (
            <div key={provider.id} className="ds-card-outer">
              <div className="ds-card-inner p-4">
                <div className="absolute inset-0 ds-noise pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/[0.06] shrink-0"
                        style={isAtlassianOAuth ? { background: 'linear-gradient(to bottom, #2684FF, #1a5dc4)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4)' }
                          : is9router ? { background: '#ff4405', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' }
                          : isAnthropic ? { background: '#d67660', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' }
                          : isOpencode ? { background: '#f0f0f0', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)' }
                          : isCodex ? { background: '#fffefa', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)' }
                          : { background: 'linear-gradient(to bottom, #2a2a2a, #161616)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.6)' }}>
                        {provider.logo.startsWith('/') ? (
                          <img src={provider.logo} alt={provider.name} width="24" height="24" className="object-contain" />
                        ) : (
                          <iconify-icon icon={provider.logo} width="20"
                            className={isAtlassianOAuth ? 'text-white' : state === 'connected' ? 'text-emerald-400' : 'text-white/60'} />
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-white ds-text-shadow truncate">{provider.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isVcsOAuth && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium border border-purple-500/20 bg-purple-500/[0.06] text-purple-400">OAuth</span>
                      )}
                      {isOAuth && !isVcsOAuth && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium border border-purple-500/20 bg-purple-500/[0.06] text-purple-400">OAuth</span>
                      )}
                      <span className={`w-2 h-2 rounded-full ${state === 'connected' ? 'bg-emerald-400 animate-pulse' : state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
                    </div>
                  </div>

                  <p className="text-xs text-white/60 font-light leading-relaxed mb-4 flex-1">{provider.description}</p>

                  {/* ── Jira disconnected ── */}
                  {jiraProvider && state !== 'connected' && (
                    <>
                      <div className="mb-2 p-2 rounded border border-[#2684FF]/10 bg-[#2684FF]/[0.03]">
                        <p className="text-xs text-[#2684FF]/60 font-light leading-relaxed">
                          Scopes: <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">read:jira-work</code>{' '}
                          <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">read:jira-user</code>
                        </p>
                      </div>
                      <div>
                        <button type="button" onClick={() => { window.location.href = apiUrl('/api/integrations/jira/authorize') }} disabled={state === 'connecting'}
                          className="w-fit relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                            {state === 'connecting' ? <><iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />Connecting…</> : 'Connect'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── Bitbucket disconnected ── */}
                  {bbProvider && state !== 'connected' && (
                    <>
                      <div className="mb-2 p-2 rounded border border-[#2684FF]/10 bg-[#2684FF]/[0.03]">
                        <p className="text-xs text-[#2684FF]/60 font-light leading-relaxed">
                          Scopes: <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">repository</code>{' '}
                          <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">pullrequest</code>
                        </p>
                      </div>
                      <div>
                        <button type="button" onClick={() => { window.location.href = apiUrl('/api/integrations/bitbucket/authorize') }} disabled={state === 'connecting'}
                          className="w-fit relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                            {state === 'connecting' ? <><iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />Connecting…</> : 'Connect'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── GitHub disconnected ── */}
                  {ghProvider && state !== 'connected' && (
                    <>
                      <div className="mb-2 p-2 rounded border border-[#2684FF]/10 bg-[#2684FF]/[0.03]">
                        <p className="text-xs text-[#2684FF]/60 font-light leading-relaxed">
                          Scopes: <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">repo</code>
                        </p>
                      </div>
                      <div>
                        <button type="button" onClick={() => { window.location.href = apiUrl('/api/integrations/github/authorize') }} disabled={state === 'connecting'}
                          className="w-fit relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                            {state === 'connecting' ? <><iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />Connecting…</> : 'Connect'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── Engine disconnected ── */}
                  {isEngine && !isOAuth && state !== 'connected' && (
                    <div>
                      <button type="button" 
                        onClick={() => { if (!isDisabled) { setSelectedProviderId(provider.id); setModalOpen(true) }}} 
                        disabled={state === 'connecting' || isDisabled}
                        className="w-fit relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed">
                        <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                        <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                          style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                          {isDisabled ? 'Soon!' : state === 'connecting' ? <><iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />Connecting…</> : 'Add key'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* ── Engine OAuth (Codex) disconnected ── */}
                  {isEngine && isOAuth && state !== 'connected' && (
                    <div className="p-2 rounded border border-purple-500/10 bg-purple-500/[0.03]">
                      <p className="text-xs text-purple-300/70 font-light leading-relaxed">
                        Run <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">pi --login codex</code> in your terminal.
                      </p>
                    </div>
                  )}

                  {/* ── Engine connected disconnect ── */}
                  {state === 'connected' && !jiraProvider && !bbProvider && !ghProvider && (
                    <div className="pt-3 border-t border-white/[0.04]">
                      <button type="button" onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}
                        className="w-fit relative inline-flex group disabled:opacity-50">
                        <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                        <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                          style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)' }}>Disconnect</span>
                      </button>
                    </div>
                  )}

                  {/* ── Jira connected ── */}
                  {jiraProvider && state === 'connected' && (
                    <div className="mt-auto">
                      <div className="mb-2 p-2 rounded border border-emerald-500/10 bg-emerald-500/[0.03]">
                        <p className="text-xs text-emerald-400/70 font-light">Connected. Tickets will appear in the pipeline.</p>
                      </div>
                      <div className="pt-3 border-t border-white/[0.04]">
                        <button type="button" onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}
                          className="w-fit relative inline-flex group disabled:opacity-50">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)' }}>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Bitbucket connected ── */}
                  {bbProvider && state === 'connected' && (
                    <div className="mt-auto">
                      <div className="mb-2 p-2 rounded border border-emerald-500/10 bg-emerald-500/[0.03]">
                        <p className="text-xs text-emerald-400/70 font-light">Connected. Repos and PRs are now available.</p>
                      </div>
                      <div className="pt-3 border-t border-white/[0.04]">
                        <button type="button" onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}
                          className="w-fit relative inline-flex group disabled:opacity-50">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)' }}>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── GitHub connected ── */}
                  {ghProvider && state === 'connected' && (
                    <div className="mt-auto">
                      <div className="mb-2 p-2 rounded border border-emerald-500/10 bg-emerald-500/[0.03]">
                        <p className="text-xs text-emerald-400/70 font-light">Connected. Pick a repo in Settings to get started.</p>
                      </div>
                      <div className="pt-3 border-t border-white/[0.04]">
                        <button type="button" onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}
                          className="w-fit relative inline-flex group disabled:opacity-50">
                          <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                          <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)' }}>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Engine connected models ── */}
                  {state === 'connected' && !jiraProvider && !bbProvider && !ghProvider && models.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1 overflow-hidden">
                        {models.slice(0, 3).map((m) => (
                          <span key={m.id} className="px-2 py-0.5 rounded-md text-[10px] font-light text-white/60 bg-white/[0.04] border border-white/[0.06] shrink-0">{m.id}</span>
                        ))}
                        {models.length > 3 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-light text-white/40 bg-white/[0.04] border border-white/[0.06] shrink-0">+{models.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ConnectModal open={modalOpen} onOpenChange={setModalOpen} provider={PROVIDERS.find(p => p.id === selectedProviderId) ?? PROVIDERS[0]}
        connecting={connectingId === selectedProviderId} error={error} onConnect={(key) => handleConnect(selectedProviderId ?? PROVIDERS[0].id, key)} />
    </div>
  )
}
