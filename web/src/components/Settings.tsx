import { Link } from 'react-router-dom'
import { useState } from 'react'
import ProjectSection from './ProjectSection'
import BlocklistSection, { mockBlocklist, type BlocklistEntry } from './BlocklistSection'
import CredentialsSection, { mockCredentials, type Credential } from './CredentialsSection'
import AccountSection, { mockAccount } from './AccountSection'

export default function Settings() {
  // State for mock data (UI-only phase)
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>(mockBlocklist)
  const [credentials, setCredentials] = useState<Credential[]>(mockCredentials)

  const handleAddBlocklistEntry = (pattern: string, reason: string) => {
    const newEntry: BlocklistEntry = {
      id: crypto.randomUUID(),
      pattern,
      reason,
      source: 'human',
    }
    setBlocklist((prev) => [...prev, newEntry])
  }

  const handleDeleteBlocklistEntry = (id: string) => {
    setBlocklist((prev) => prev.filter((entry) => entry.id !== id))
  }

  const handleAddCredential = (name: string, _value: string) => {
    // In real implementation, value would be sent to backend
    // Here we just track that the credential exists
    setCredentials((prev) => {
      const existing = prev.find((c) => c.name === name)
      if (existing) {
        return prev.map((c) =>
          c.name === name ? { ...c, updatedAt: new Date().toISOString() } : c
        )
      }
      return [...prev, { name, updatedAt: new Date().toISOString() }]
    })
  }

  const handleChangePassword = (_currentPassword: string, _newPassword: string) => {
    // In real implementation, this would call the backend API
    console.log('Password change requested')
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
          Manage project, blocklist, credentials, and account settings
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <ProjectSection />
        <BlocklistSection
          entries={blocklist}
          onAdd={handleAddBlocklistEntry}
          onDelete={handleDeleteBlocklistEntry}
        />
        <CredentialsSection
          credentials={credentials}
          onAdd={handleAddCredential}
        />
        <AccountSection
          account={mockAccount}
          onChangePassword={handleChangePassword}
        />
      </div>
    </div>
  )
}
