import { useState } from 'react'
import Modal from './Modal'

export interface Account {
  username: string
  email: string
}

interface AccountSectionProps {
  account: Account
  onChangePassword: (currentPassword: string, newPassword: string) => void
}

// Mock data for UI development
export const mockAccount: Account = {
  username: 'jane_doe',
  email: 'jane@example.com',
}

export default function AccountSection({ account, onChangePassword }: AccountSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)

    if (!currentPassword.trim()) {
      setError('Current password is required')
      return
    }
    if (!newPassword.trim()) {
      setError('New password is required')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from current password')
      return
    }

    onChangePassword(currentPassword, newPassword)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowModal(false)
  }

  const handleClose = () => {
    setShowModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }

  return (
    <>
      <div className="ds-card-outer ds-shadow-elevated">
        <div className="ds-card-inner p-6">
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
                Account
              </h3>
            </div>

            {/* Account info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-white/50 font-light">Username</span>
                <span className="text-sm text-white/80 font-light">{account.username}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-sm text-white/50 font-light">Email</span>
                <span className="text-sm text-white/80 font-light">{account.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-sm text-white/50 font-light">Password</span>
                <button
                  className="px-4 py-1.5 text-xs text-white/70 bg-white/[0.03] rounded-lg border border-white/[0.05] transition-colors font-light hover:bg-white/[0.06]"
                  onClick={() => setShowModal(true)}
                >
                  Change password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={showModal}
        onClose={handleClose}
        title="Change Password"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Current password
            </label>
            <input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-light"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              New password
            </label>
            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-light"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Confirm new password
            </label>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-light"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#3a1d1d] border border-[#522525]">
              <iconify-icon icon="solar:close-circle-linear" width="14" className="text-[#ff8a8a]" />
              <span className="text-xs text-[#ff8a8a] font-light">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.04]">
            <button
              className="px-4 py-2 text-xs text-white/70 bg-white/[0.03] rounded-lg border border-white/[0.05] transition-colors font-light hover:bg-white/[0.06]"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="relative inline-flex group"
              onClick={handleSave}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span className="relative px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Update password
              </span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
