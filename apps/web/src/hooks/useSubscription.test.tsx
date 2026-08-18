import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { useSubscription } from './useSubscription'
import type { AuthState } from '../api/auth'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function useCombined() {
  const auth = useAuth()
  const sub = useSubscription()
  return { auth, sub }
}

interface Handlers {
  me: () => Record<string, unknown>
  subscription?: () => Record<string, unknown>
}

function fetchMock(handlers: Handlers) {
  const subscriptionCalls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : String(input)
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: async () => handlers.me(),
      } as Response)
    }
    if (url === '/api/subscriptions/active') {
      subscriptionCalls.push(url)
      return Promise.resolve({
        ok: true,
        json: async () => handlers.subscription?.() ?? { planSlug: null },
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
  return { subscriptionCalls }
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch (and cache a null plan) while unauthenticated', async () => {
    const m = fetchMock({ me: () => ({ state: 'unauthenticated' }) })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    renderHook(() => useCombined(), { wrapper: makeWrapper(qc) })

    await waitFor(() => {
      expect(qc.getQueryData<AuthState>(['auth'])?.status).toBe('unauthenticated')
    })

    // Give any (buggy) unconditional subscription fetch a chance to fire.
    await new Promise((r) => setTimeout(r, 0))

    expect(m.subscriptionCalls).toEqual([])
  })

  it('fetches the subscription once authenticated', async () => {
    const m = fetchMock({
      me: () => ({ state: 'authenticated', user: { username: 'aziz' } }),
      subscription: () => ({ planSlug: 'starter', status: 'active', expired: false }),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useCombined(), { wrapper: makeWrapper(qc) })

    await waitFor(() => {
      expect(result.current.sub.data?.planSlug).toBe('starter')
    })

    expect(m.subscriptionCalls).toContain('/api/subscriptions/active')
  })
})
