'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import LoginForm from './LoginForm'

interface LoginModalProps {
  onClose: () => void
}

export function LoginModal({ onClose }: LoginModalProps) {
  const { state, login, loginError, loginPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'authenticated') {
      router.push(state.role === 'admin' ? '/admin/dashboard' : '/dashboard')
    }
  }, [state.status, router])

  // close on Escape
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
      <LoginForm
        onSubmit={async (username, password) => {
          try { await login(username, password) } catch { /* loginError surfaces */ }
        }}
        error={loginError}
        isPending={loginPending}
        onBack={onClose}
        onSwitchToRegister={() => router.push('/register')}
        onForgotPassword={() => router.push('/forgot-password')}
        modal
      />
    </div>
  )
}
