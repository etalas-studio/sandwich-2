import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ProjectSection from './ProjectSection'
import AccountSection from './AccountSection'
import type { Account } from './AccountSection'
import { fetchSettings, updateAutoOpenPr, fetchAccount, changePassword } from '../api/projects'

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
      </div>
    </div>
  )
}
