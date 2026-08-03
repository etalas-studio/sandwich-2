import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import type { AuthState } from '../api/auth'

// --------------- helpers ---------------

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockFetchMeResponse(state: AuthState) {
  const body: Record<string, unknown> = { state: state.status }
  if (state.status === 'authenticated') body.user = { username: state.username }
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input)
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: async () => body,
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── initial state ──

  it('returns loading true while the initial /me request is in-flight', async () => {
    // never resolve — stays loading
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.state.status).toBe('unauthenticated') // fallback while loading
  })

  it('returns authenticated state and username when /me responds with authenticated', async () => {
    mockFetchMeResponse({ status: 'authenticated', username: 'alice' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.state).toEqual<AuthState>({ status: 'authenticated', username: 'alice' })
  })

  it('returns setup_required state when /me responds with setup_required', async () => {
    mockFetchMeResponse({ status: 'setup_required' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.state).toEqual<AuthState>({ status: 'setup_required' })
  })

  it('returns unauthenticated state when /me responds with unauthenticated', async () => {
    mockFetchMeResponse({ status: 'unauthenticated' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.state).toEqual<AuthState>({ status: 'unauthenticated' })
  })

  // ── login ──

  it('login calls postLogin and refreshes auth state on success', async () => {
    mockFetchMeResponse({ status: 'unauthenticated' })
    let loginCalled = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/auth/me') {
        // first call: unauthenticated, then after login: authenticated
        return {
          ok: true,
          json: async () =>
            loginCalled
              ? { state: 'authenticated', user: { username: 'alice' } }
              : { state: 'unauthenticated' },
        } as Response
      }
      if (url === '/api/auth/login') {
        loginCalled = true
        return { ok: true, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.loginPending).toBe(false)
    expect(result.current.loginError).toBeNull()

    await act(async () => {
      await result.current.login('alice', 'secret')
    })

    await waitFor(() => {
      expect(result.current.state).toEqual<AuthState>({ status: 'authenticated', username: 'alice' })
    })
  })

  it('login sets loginError on failure', async () => {
    mockFetchMeResponse({ status: 'unauthenticated' })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/auth/login') {
        return { ok: false, status: 401, json: async () => ({ error: 'bad password' }) } as Response
      }
      if (url === '/api/auth/me') {
        return { ok: true, json: async () => ({ state: 'unauthenticated' }) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      try {
        await result.current.login('alice', 'wrong')
      } catch {
        // expected — mutation throws
      }
    })

    await waitFor(() => {
      expect(result.current.loginError).toBe('bad password')
    })
  })

  // ── register ──

  it('register calls postRegister and refreshes auth state on success', async () => {
    mockFetchMeResponse({ status: 'setup_required' })
    let registered = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/auth/me') {
        return {
          ok: true,
          json: async () =>
            registered
              ? { state: 'authenticated', user: { username: 'bob' } }
              : { state: 'setup_required' },
        } as Response
      }
      if (url === '/api/auth/register') {
        registered = true
        return { ok: true, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.register('bob', 'bob@test.com', 'secret')
    })

    await waitFor(() => {
      expect(result.current.state).toEqual<AuthState>({ status: 'authenticated', username: 'bob' })
    })
  })

  it('register sets registerError on failure', async () => {
    mockFetchMeResponse({ status: 'setup_required' })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/auth/register') {
        return { ok: false, status: 409, json: async () => ({ error: 'username taken' }) } as Response
      }
      if (url === '/api/auth/me') {
        return { ok: true, json: async () => ({ state: 'setup_required' }) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      try {
        await result.current.register('bob', 'b@b.com', 'secret')
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.registerError).toBe('username taken')
    })
  })

  // ── logout ──

  it('logout calls postLogout and refreshes auth state', async () => {
    mockFetchMeResponse({ status: 'authenticated', username: 'alice' })
    let loggedOut = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/auth/me') {
        return {
          ok: true,
          json: async () =>
            loggedOut ? { state: 'unauthenticated' } : { state: 'authenticated', user: { username: 'alice' } },
        } as Response
      }
      if (url === '/api/auth/logout') {
        loggedOut = true
        return { ok: true } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.state.status).toBe('authenticated')

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('unauthenticated')
    })
  })
})
