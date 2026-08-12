import { useState } from 'react'
import Modal from './Modal'

export interface Credential {
  name: string
  updatedAt: string
}

interface CredentialsSectionProps {
  credentials: Credential[]
  onAdd: (name: string, value: string) => void
}

// Mock data for UI development
export const mockCredentials: Credential[] = [
  { name: 'DATABASE_URL', updatedAt: '2026-08-02T10:30:00Z' },
  { name: 'OPENAI_API_KEY', updatedAt: '2026-08-01T14:20:00Z' },
]

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }
  if (diffMinutes > 0) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  }
  return 'Just now'
}

export default function CredentialsSection({ credentials, onAdd }: CredentialsSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const handleSave = () => {
    if (name.trim() && value.trim()) {
      onAdd(name.trim(), value.trim())
      setName('')
      setValue('')
      setShowModal(false)
    }
  }

  return (
    <div className="ds-card-outer ds-shadow-elevated">
      <div className="ds-card-inner p-6">
        <div className="absolute inset-0 ds-noise pointer-events-none" />
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
                Credentials
              </h3>
              <span className="text-xs text-white/40 font-light">
                {credentials.length} {credentials.length === 1 ? 'credential' : 'credentials'}
              </span>
            </div>
            <button
              className="relative inline-flex group"
              onClick={() => setShowModal(true)}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span className="relative px-4 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Add credential
              </span>
            </button>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {credentials.length === 0 ? (
              <p className="text-sm text-white/40 font-light py-4 text-center">
                No credentials stored yet. Add environment variables the agent may need.
              </p>
            ) : (
              credentials.map((credential) => (
                <div
                  key={credential.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <code className="text-sm text-white/80 font-mono">
                      {credential.name}
                    </code>
                    <span className="text-xs text-white/40 font-light">
                      Updated {formatRelativeTime(credential.updatedAt)}
                    </span>
                  </div>
                  <button
                    className="text-white/40 hover:text-white/70 text-xs font-light transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setName(credential.name)
                      setShowModal(true)
                    }}
                  >
                    Update
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Security note */}
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-xs text-white/30 font-light flex items-center gap-2">
              <iconify-icon icon="solar:shield-check-linear" width="14" />
              Credential values are never displayed after saving
            </p>
          </div>
        </div>
      </div>

      {/* Add/Update Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setName('')
          setValue('')
        }}
        title={name && credentials.some(c => c.name === name) ? 'Update Credential' : 'Add Credential'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. DATABASE_URL"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Value
            </label>
            <input
              type="password"
              placeholder="Enter the secret value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.04]">
            <button
              className="px-4 py-2 text-xs text-white/70 bg-white/[0.03] rounded-lg border border-white/[0.05] transition-colors font-light hover:bg-white/[0.06]"
              onClick={() => {
                setShowModal(false)
                setName('')
                setValue('')
              }}
            >
              Cancel
            </button>
            <button
              className="relative inline-flex group"
              onClick={handleSave}
              disabled={!name.trim() || !value.trim()}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span className={`relative px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] ${!name.trim() || !value.trim() ? 'opacity-50' : ''}`} style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Save
              </span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
