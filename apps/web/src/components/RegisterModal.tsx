'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'

interface RegisterModalProps {
  onClose: () => void
  onSwitchToLogin: () => void
}

export function RegisterModal({ onClose, onSwitchToLogin }: RegisterModalProps) {
  const { state, register, login, registerError, registerPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [state.status, router])

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
      <SetupForm
        onSubmit={register}
        login={login}
        error={registerError}
        isPending={registerPending}
        onBack={onClose}
        onSwitchToLogin={onSwitchToLogin}
        modal
      />
    </div>
  )
}
