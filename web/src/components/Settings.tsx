import { Link } from 'react-router-dom'
import ProjectSection from './ProjectSection'
import AccountSection, { mockAccount } from './AccountSection'

interface SettingsProps {
  onPurge?: () => void
}

export default function Settings({ onPurge }: SettingsProps) {
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
          Manage project and account settings
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <ProjectSection />
        <AccountSection
          account={mockAccount}
          onChangePassword={handleChangePassword}
          onPurge={onPurge}
        />
      </div>
    </div>
  )
}
