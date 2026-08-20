'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { identifyPostHog, initPostHog } from '../lib/posthog'

export default function AppEffects() {
  const router = useRouter()
  const pathname = usePathname()
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
    if (state?.status === 'authenticated' && !subLoading) {
      const pending = localStorage.getItem('sandwich_pending_plan')
      if (pending === 'starter' || pending === 'pro') {
        if (sub?.planSlug) {
          localStorage.removeItem('sandwich_pending_plan')
          return
        }
        if (!pathname.startsWith('/pay')) {
          router.replace(`/pay?plan=${pending}`)
        }
        return
      }
      if (!sub?.planSlug && !pathname.startsWith('/pay')) {
        router.replace('/pay?plan=starter')
      }
    }
  }, [state?.status, sub?.planSlug, subLoading, pathname, router])

  return null
}
