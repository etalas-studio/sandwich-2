'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { identifyPostHog, initPostHog } from '../lib/posthog'

export default function AppEffects() {
  const router = useRouter()
  const { state } = useAuth()
  const { data: sub, isLoading: subLoading } = useSubscription()

  const authUserId = state?.status === 'authenticated' ? state.id : ''
  const authUsername = state?.status === 'authenticated' ? state.username : ''

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (state?.status === 'authenticated' && !subLoading) {
      identifyPostHog(authUserId, { username: authUsername, plan: sub?.planSlug ?? null })
    }
  }, [state?.status, authUserId, authUsername, sub?.planSlug, subLoading])

  useEffect(() => {
    if (state?.status === 'authenticated') {
      const pending = localStorage.getItem('sandwich_pending_plan')
      if (pending === 'pro') {
        localStorage.removeItem('sandwich_pending_plan')
        router.replace('/checkout?plan=pro')
      }
    }
  }, [state?.status, router])

  return null
}
