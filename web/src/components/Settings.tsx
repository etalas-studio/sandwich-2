import { useState, useEffect } from 'react'
import ConnectModal from './ConnectModal'
import type { Account } from './AccountSection'
import { fetchSettings, updateAutoOpenPr, fetchAccount } from '../api/projects'
import { apiUrl } from '../api/base'
import { useIntegrations } from '../hooks/useIntegrations'
import { useProject } from '../hooks/useProject'
import { useLanguage, type Lang } from '../lib/i18n'

interface SettingsProps {
  onPurge?: () => void
}

const INTEGRATION_PROVIDERS = [
  {
    id: 'opencode-go',
    name: 'Open Code',
    logo: '/logos/opencode-logo.png',
    description: 'Premium models — DeepSeek V4, Kimi K3, Qwen3.7, Grok 4.5, and more.',
    docsUrl: 'https://opencode.ai',
    isImage: true as const,
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: 'simple-icons:groq',
    description: 'Fast inference for SANDWICH and getokui — Qwen3, Llama, and more.',
    docsUrl: 'https://console.groq.com/keys',
    isImage: false as const,
  },
  {
    id: 'github',
    name: 'GitHub',
    logo: 'simple-icons:github',
    description: 'Connect your GitHub account to pick a repo and open PRs via OAuth 2.0.',
    docsUrl: 'https://github.com/settings/developers',
    isImage: false as const,
  },
]

const cardStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '1rem',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column' as const,
}

function DarkBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40"
      style={{ backgroundColor: '#f91814' }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
    >
      {children}
    </button>
  )
}

function Toggle({ label, description, checked, onChange, disabled }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 mr-4">
        <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{label}</span>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        style={{ backgroundColor: checked ? '#f91814' : 'rgba(255,255,255,0.12)' }}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
        />
      </button>
    </div>
  )
}

function LanguageCard() {
  const { lang, setLang, t } = useLanguage()
  const OPTIONS: { value: Lang; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Bahasa Indonesia' },
  ]
  return (
    <div style={cardStyle}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('settings_language')}</p>
      <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('settings_language_desc')}</p>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => setLang(opt.value)}
            className="flex-1 px-3 py-2 text-xs font-medium transition-colors"
            style={lang === opt.value
              ? { backgroundColor: '#f91814', color: '#ffffff' }
              : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)' }
            }>
            {opt.label}
          </button>
        ))}
      </div>
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
  const { project } = useProject()

  useEffect(() => {
    fetchSettings()
      .then((s) => setAutoOpenPr(s.autoOpenPr))
      .catch(() => {})
      .finally(() => setLoadingSetting(false))
  }, [])

  useEffect(() => {
    fetchAccount()
      .then((a) => setAccount(a))
      .catch(() => {})
      .finally(() => setAccountLoading(false))
  }, [])

  const handleToggle = async (enabled: boolean) => {
    setToggling(true)
    setAutoOpenPr(enabled)
    try { await updateAutoOpenPr(enabled) }
    catch { setAutoOpenPr(!enabled) }
    finally { setToggling(false) }
  }

  const handleIntegrationConnect = async (providerId: string, key: string) => {
    await connect(providerId, key)
    setModalOpen(false)
  }

  const getIntegration = (id: string) => integrations.find((i) => i.id === id)
  const getState = (id: string) => {
    if (connectingId === id) return 'connecting'
    return getIntegration(id)?.connected ? 'connected' : 'disconnected'
  }

  return (
    <div className="h-full overflow-y-auto p-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Manage project and account settings</p>
      </div>

      {integrationError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {integrationError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Pipeline */}
        <div style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Pipeline</p>
          {loadingSetting ? (
            <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
          ) : (
            <Toggle
              label="Auto Open PR"
              description="Automatically opens a PR after a ticket is implemented and verified."
              checked={autoOpenPr}
              onChange={handleToggle}
              disabled={toggling}
            />
          )}
        </div>

        <LanguageCard />

        {/* Account */}
        {accountLoading ? (
          <div style={cardStyle}>
            <div className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
          </div>
        ) : account ? (
          <div style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Account</p>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Username</span>
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{account.username}</span>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Email</span>
                <span className="text-xs font-medium truncate ml-4" style={{ color: 'rgba(255,255,255,0.85)' }}>{account.email}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <GhostBtn>Change password</GhostBtn>
              {onPurge && (
                <button type="button" onClick={onPurge} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ color: '#ef4444' }}>
                  Purge data
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Project */}
        <div style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Project</p>
          {project ? (
            <div className="flex items-center gap-2">
              <iconify-icon icon="simple-icons:github" width="14" style={{ color: '#6b7280' }} />
              <span className="text-xs font-medium" style={{ color: '#111827' }}>{project.repoSlug}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>Connected</span>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Connect a repo to enable automation and PR creation.</p>
              <div className="flex flex-col gap-2">
                {[{ id: 'github', name: 'GitHub', icon: 'simple-icons:github' }, { id: 'bitbucket', name: 'Bitbucket', icon: 'simple-icons:bitbucket' }].map(p => (
                  <a key={p.id} href={apiUrl(`/api/integrations/${p.id}/authorize`)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                    <iconify-icon icon={p.icon} width="14" />
                    {p.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Integration cards */}
        {INTEGRATION_PROVIDERS.map((provider) => {
          const state = getState(provider.id)
          const isGh = provider.id === 'github'
          const isOpencode = provider.id === 'opencode-go' || provider.id === 'groq'
          const integration = getIntegration(provider.id)
          const isOAuth = integration?.authType === 'oauth'

          return (
            <div key={provider.id} style={cardStyle}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {provider.isImage ? (
                      <img src={provider.logo} alt={provider.name} width="22" height="22" className="object-contain" />
                    ) : (
                      <iconify-icon icon={provider.logo} width="18" style={{ color: state === 'connected' ? '#4ade80' : 'rgba(255,255,255,0.6)' }} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{provider.name}</h4>
                    {isGh && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>OAuth</span>}
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${state === 'connected' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: state === 'connected' ? '#4ade80' : state === 'connecting' ? '#f59e0b' : 'rgba(255,255,255,0.2)' }} />
              </div>

              <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{provider.description}</p>

              {isGh && state !== 'connected' && (
                <DarkBtn onClick={() => { window.location.href = apiUrl('/api/integrations/github/authorize') }} disabled={state === 'connecting'}>
                  {state === 'connecting' ? 'Connecting…' : 'Connect'}
                </DarkBtn>
              )}
              {isGh && state === 'connected' && (
                <GhostBtn onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}>Disconnect</GhostBtn>
              )}
              {isOpencode && !isOAuth && state !== 'connected' && (
                <DarkBtn onClick={() => { setSelectedProviderId(provider.id); setModalOpen(true) }} disabled={state === 'connecting'}>
                  {state === 'connecting' ? 'Connecting…' : 'Add key'}
                </DarkBtn>
              )}
              {isOpencode && state === 'connected' && (
                <GhostBtn onClick={() => disconnect(provider.id)} disabled={connectingId === provider.id}>Disconnect</GhostBtn>
              )}
            </div>
          )
        })}
      </div>

      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        provider={INTEGRATION_PROVIDERS.find((p) => p.id === selectedProviderId) ?? INTEGRATION_PROVIDERS[0]}
        connecting={connectingId === selectedProviderId}
        error={integrationError}
        onConnect={(key) => handleIntegrationConnect(selectedProviderId ?? INTEGRATION_PROVIDERS[0].id, key)}
      />
    </div>
  )
}
