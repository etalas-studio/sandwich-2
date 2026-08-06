import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="ds-card-outer ds-shadow-elevated w-full max-w-md" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
                {title}
              </h3>
              <button
                className="text-white/40 hover:text-white transition-colors"
                onClick={onClose}
              >
                <iconify-icon icon="solar:close-circle-linear" width="20" />
              </button>
            </div>

            {/* Content */}
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
