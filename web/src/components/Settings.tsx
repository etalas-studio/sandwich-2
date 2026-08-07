import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ProjectSection from './ProjectSection'
import AccountSection from './AccountSection'
import ConnectModal from './ConnectModal'
import type { Account } from './AccountSection'
import { fetchSettings, updateAutoOpenPr, fetchAccount, changePassword } from '../api/projects'
import { useIntegrations } from '../hooks/useIntegrations'

const INTEGRATION_PROVIDERS = [
  {
    id: 'opencode-go',
    name: 'Open Code',
    logo: '/logos/opencode-logo.png',
    description: 'Premium models — DeepSeek V4, Kimi K3, Qwen3.7, Grok 4.5, and more.',
    docsUrl: 'https://opencode.ai',
    isImage: true,
    iconBg: { background: '#f0f0f0', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)' },
  },
  {
    id: 'github',
    name: 'GitHub',
    logo: 'simple-icons:github',
    description: 'Connect your GitHub account to pick a repo and open PRs via OAuth 2.0.',
    docsUrl: 'https://github.com/settings/developers',
    isImage: false,
    iconBg: { background: 'linear-gradient(to bottom, #2a2a2a, #161616)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.6)' },
  },
] as const

interface SettingsProps {
  onPurge?: () => void
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 mr-4">
        <span className="text-sm text-white/80 font-light">{label}</span>
        <p className="text-xs text-white/40 font-light mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-white/20' : 'bg-white/[0.06]'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          }`}
          style={{
            boxShadow: checked
              ? '0 0 6px rgba(255,255,255,0.3)'
              : '0 0 2px rgba(255,255,255,0.1)',
          }}
        />
      </button>
    </div>
  )
}

export default function Settings({ onPurge }: SettingsProps) {
  const [autoOpenPr, setAutoOpenPr] = useState(true)
  const [loadingSetting, setLoadingSetting] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const { integrations, connect, disconnect, connectingId, error: integrationError } = useIntegrations()

  useEffect(() => {
    fetchSettings()
      .then((s) => setAutoOpenPr(s.autoOpenPr))
      .catch(() => { /* use default */ })
      .finally(() => setLoadingSetting(false))
  }, [])

  useEffect(() => {
    fetchAccount()
      .then((a) => setAccount(a))
      .catch(() => { /* leave null */ })
      .finally(() => setAccountLoading(false))
  }, [])

  const handleToggle = async (enabled: boolean) => {
    setToggling(true)
    setAutoOpenPr(enabled) // optimistic
    try {
      await updateAutoOpenPr(enabled)
    } catch {
      setAutoOpenPr(!enabled) // revert
    } finally {
      setToggling(false)
    }
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await changePassword(currentPassword, newPassword)
  }

  const handleIntegrationConnect = async (providerId: string, key: string) => {
    await connect(providerId, key)
    setModalOpen(false)
  }

  const getIntegration = (providerId: string) => integrations.find((i) => i.id === providerId)

  const getState = (providerId: string) => {
    if (connectingId === providerId) return 'connecting'
    return getIntegration(providerId)?.connected ? 'connected' : 'disconnected'
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link
            className="text-white/40 hover:text-white transition-colors"
            to="/overview"
          >
            <iconify-icon icon="solar:arrow-left-linear" width="16" />
          </Link>
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
            Settings
          </h1>
        </div>
        <p className="text-sm text-white/50 font-light ml-7">
          Manage project and account settings
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <ProjectSection />

        {/* Pipeline Settings */}
        <div className="ds-card-outer ds-shadow-elevated">
          <div className="ds-card-inner p-6">
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow mb-4">
                Pipeline
              </h3>
              {loadingSetting ? (
                <div className="h-10 animate-pulse bg-white/[0.02] rounded-lg" />
              ) : (
                <Toggle
                  label="Auto Open PR"
                  description="When enabled, the pipeline automatically opens a pull request after a ticket is implemented and verified. Disable to manually create PRs after review."
                  checked={autoOpenPr}
                  onChange={handleToggle}
                  disabled={toggling}
                />
              )}
            </div>
          </div>
        </div>

        {accountLoading ? (
          <div className="ds-card-outer ds-shadow-elevated">
            <div className="ds-card-inner p-6">
              <div className="absolute inset-0 ds-noise pointer-events-none" />
              <div className="relative z-10 h-32 animate-pulse bg-white/[0.02] rounded-lg" />
            </div>
          </div>
        ) : account ? (
          <AccountSection
            account={account}
            onChangePassword={handleChangePassword}
            onPurge={onPurge}
          />
        ) : null}

        {/* Integrations */}
        <div>
          <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow mb-3">Integrations</h3>
          {integrationError && (
            <div className="ds-card-outer mb-4">
              <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
                <p className="text-sm text-[#ff8a8a]">{integrationError}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {INTEGRATION_PROVIDERS.map((provider) => {
              const state = getState(provider.id)
              const isGh = provider.id === 'github'
              const isOpencode = provider.id === 'opencode-go'
              const integration = getIntegration(provider.id)
              const isOAuth = integration?.authType === 'oauth'

              return (
                <div key={provider.id} className="ds-card-outer ds-shadow-elevated">
                  <div className="ds-card-inner p-5">
                    <div className="absolute inset-0 ds-noise pointer-events-none" />
                    <div className="relative z-10 flex flex-col h-full">

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/[0.06] shrink-0"
                            style={provider.iconBg}>
                            {provider.isImage ? (
                              <img src={provider.logo} alt={provider.name} width="24" height="24" className="object-contain" />
                            ) : (
                              <iconify-icon icon={provider.logo} width="20"
                                className={state === 'connected' ? 'text-emerald-400' : 'text-white/60'} />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-white ds-text-shadow">{provider.name}</h4>
                            {isGh && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium border border-purple-500/20 bg-purple-500/[0.06] text-purple-400">OAuth</span>}
                          </div>
                        </div>
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${state === 'connected' ? 'bg-emerald-400 animate-pulse' : state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
                      </div>

                      <p className="text-xs text-white/60 font-light leading-relaxed mb-4 flex-1">{provider.description}</p>

                      {/* GitHub disconnected */}
                      {isGh && state !== 'connected' && (
                        <>
                          <div className="mb-2 p-2 rounded border border-[#2684FF]/10 bg-[#2684FF]/[0.03]">
                            <p className="text-xs text-[#2684FF]/60 font-light">
                              Scope: <code className="px-1 py-0.5 bg-[#0a0a0a] rounded text-white/60 font-mono">repo</code>
                            </p>
                          </div>
                          <div>
                            <button type="button" onClick={() => { window.location.href = '/api/integrations/github/authorize' }} disabled={state === 'connecting'}
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

                      {/* GitHub connected */}
                      {isGh && state === 'connected' && (
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

                      {/* OpenCode key input */}
                      {isOpencode && !isOAuth && state !== 'connected' && (
                        <div>
                          <button type="button"
                            onClick={() => { setSelectedProviderId(provider.id); setModalOpen(true) }}
                            disabled={state === 'connecting'}
                            className="w-fit relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed">
                            <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                            <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                              style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                              {state === 'connecting' ? <><iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />Connecting…</> : 'Add key'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* OpenCode connected */}
                      {isOpencode && state === 'connected' && (
                        <div className="pt-3 border-t border-white/[0.04]">
                          <button type="button" onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}
                            className="w-fit relative inline-flex group disabled:opacity-50">
                            <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-60" />
                            <span className="relative px-4 py-1.5 rounded-md text-xs font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                              style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)' }}>Disconnect</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        provider={INTEGRATION_PROVIDERS.find(p => p.id === selectedProviderId) ?? INTEGRATION_PROVIDERS[0]}
        connecting={connectingId === selectedProviderId}
        error={integrationError}
        onConnect={(key) => handleIntegrationConnect(selectedProviderId ?? INTEGRATION_PROVIDERS[0].id, key)}
      />
    </div>
  )
}
