import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { state, isLoading } = useAuth()
  if (isLoading) return <div className="ds-bg min-h-screen" />
  if (state.status === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
