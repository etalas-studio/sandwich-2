'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import Dashboard from '../../components/Dashboard'

export default function Page() {
  const { state, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (state?.status === 'unauthenticated') {
      router.replace('/login')
    } else if (state?.status === 'authenticated' && state.role === 'admin') {
      router.replace('/admin/dashboard')
    }
  }, [isLoading, state, router])

  if (isLoading || state?.status !== 'authenticated') {
    return <div className="ds-bg min-h-screen" />
  }

  return (
    <Dashboard
      onBack={() => {
        void logout()
        router.push('/')
      }}
    />
  )
}
