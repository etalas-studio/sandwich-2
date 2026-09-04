'use client'

import { Suspense, useEffect } from 'react'
import ResetPasswordForm from './ResetPasswordForm'

interface ResetPasswordModalProps {
  onClose: () => void
}

export function ResetPasswordModal({ onClose }: ResetPasswordModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Suspense>
        <ResetPasswordForm onBack={onClose} modal />
      </Suspense>
    </div>
  )
}
