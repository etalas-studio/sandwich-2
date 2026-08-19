'use client'
import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import PaymentReturn from '../../../components/PaymentReturn'

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

  return <Suspense><PaymentReturn /></Suspense>
}
