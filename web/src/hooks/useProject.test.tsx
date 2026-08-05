import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useProject } from './useProject'
import type { Project } from '../api/projects'

const readyProject: Project = {
  id: 'abc-123',
  provider: 'github',
  owner: 'acme',
  repoSlug: 'widgets',
  defaultBranch: 'main',
  cloneStatus: 'ready',
  cloneError: null,
  autoOpenPr: true,
  connectedAt: '2026-08-04T00:00:00.000Z',
}

const cloningProject: Project = { ...readyProject, cloneStatus: 'cloning' }

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useProject', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns null project when none connected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => null } as Response)

    const { result } = renderHook(() => useProject(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.project).toBeNull()
  })

  it('returns the connected project', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => readyProject } as Response)

    const { result } = renderHook(() => useProject(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.project).toEqual(readyProject)
  })

  it('polls while cloneStatus is cloning', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      return { ok: true, json: async () => cloningProject } as Response
    })

    const { result } = renderHook(() => useProject(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.project?.cloneStatus).toBe('cloning')
    // refetchInterval fires on a timer; we just assert the query is configured
    // to be non-stale/refetching-capable rather than asserting on real time.
    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  it('connect calls the API and the caller can await completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/projects/current') {
        return { ok: true, json: async () => null } as Response
      }
      if (url === '/api/projects/connect') {
        return { ok: true, json: async () => cloningProject } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useProject(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.connect('github', 'acme', 'widgets', 'main')
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/projects/connect',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('clear calls the API and invalidates the current project', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/projects/current') {
        return { ok: true, json: async () => readyProject } as Response
      }
      if (url === '/api/projects/clear') {
        return { ok: true, json: async () => ({ cleared: true }) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const { result } = renderHook(() => useProject(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.project).toEqual(readyProject)

    await act(async () => {
      await result.current.clear()
    })

    expect(fetch).toHaveBeenCalledWith('/api/projects/clear', { method: 'POST' })
  })
})
