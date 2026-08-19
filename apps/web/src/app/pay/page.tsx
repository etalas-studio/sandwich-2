'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import PaymentPage from '../../components/PaymentPage'

export default function Page() {
  const { state, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && state?.status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoading, state?.status, router])

  if (isLoading || state?.status !== 'authenticated') {
    return <div className="ds-bg min-h-screen" />
  }

  return <PaymentPage />
}
