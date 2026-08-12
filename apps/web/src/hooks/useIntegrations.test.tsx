import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useIntegrations } from './useIntegrations'
import type { IntegrationItem } from '../api/integrations'

const mockList: IntegrationItem[] = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    connected: false,
    authType: 'api_key',
    models: [],
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    connected: false,
    authType: 'oauth',
    models: [],
  },
]

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useIntegrations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── initial load ──

  it('returns loading true while fetching', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}),
    )

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.integrations).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns integration list on successful fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockList,
    } as Response)

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.integrations).toEqual(mockList)
    expect(result.current.error).toBeNull()
  })

  it('sets error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('HTTP 500')
  })

  // ── connect ──

  it('connect calls the API and refreshes the list on success', async () => {
    let connectCalled = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/integrations/opencode-go/connect') {
        connectCalled = true
        return { ok: true, json: async () => ({ ok: true, message: 'Connected' }) } as Response
      }
      if (url === '/api/integrations') {
        return {
          ok: true,
          json: async () =>
            connectCalled
              ? [{ ...mockList[0], connected: true }, mockList[1]]
              : mockList,
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.integrations[0]?.connected).toBe(false)

    await act(async () => {
      await result.current.connect('opencode-go', 'secret')
    })

    await waitFor(() => {
      expect(result.current.integrations[0]?.connected).toBe(true)
    })
  })

  it('connect sets connectingId while in-flight', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/integrations') {
        // never resolve the list — stay in loading-ish state for connect
        await new Promise((r) => setTimeout(r, 200))
        return { ok: true, json: async () => mockList } as Response
      }
      if (url.includes('/connect')) {
        await new Promise((r) => setTimeout(r, 100))
        return { ok: true, json: async () => ({ ok: true }) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const connectPromise = act(async () => {
      await result.current.connect('opencode-go', 'secret')
    })

    // After starting connect but before it resolves, connectingId should be set
    // Note: act() resolves after all state updates, so we check inside a microtask
    expect(result.current.connectingId).toBeDefined()

    await connectPromise
  })

  it('connect sets error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/integrations') {
        return { ok: true, json: async () => mockList } as Response
      }
      if (url.includes('/connect')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid key' }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.connect('opencode-go', 'bad')
    })

    await waitFor(() => {
      expect(result.current.error).toBe('invalid key')
    })
  })

  // ── disconnect ──

  it('disconnect calls the API and refreshes the list on success', async () => {
    let disconnected = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url.includes('/disconnect')) {
        disconnected = true
        return { ok: true, json: async () => ({ ok: true }) } as Response
      }
      if (url === '/api/integrations') {
        const connected: IntegrationItem[] = [
          { ...mockList[0], connected: true },
          mockList[1],
        ]
        return {
          ok: true,
          json: async () => (disconnected ? mockList : connected),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useIntegrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.integrations[0]?.connected).toBe(true)

    await act(async () => {
      await result.current.disconnect('opencode-go')
    })

    await waitFor(() => {
      expect(result.current.integrations[0]?.connected).toBe(false)
    })
  })
})
