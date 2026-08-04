import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchCurrentProject,
  fetchOrgs,
  fetchRepos,
  connectProject,
  clearProject,
  syncProject,
} from './projects'
import type { Project } from './projects'

const mockProject: Project = {
  id: 'abc-123',
  provider: 'github',
  owner: 'acme',
  repoSlug: 'widgets',
  defaultBranch: 'main',
  cloneStatus: 'ready',
  cloneError: null,
  connectedAt: '2026-08-04T00:00:00.000Z',
}

describe('fetchCurrentProject', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns the current project', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockProject,
    } as Response)

    const result = await fetchCurrentProject()

    expect(result).toEqual(mockProject)
    expect(fetch).toHaveBeenCalledWith('/api/projects/current')
  })

  it('returns null when no project connected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    } as Response)

    const result = await fetchCurrentProject()

    expect(result).toBeNull()
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    await expect(fetchCurrentProject()).rejects.toThrow('HTTP 500')
  })
})

describe('fetchOrgs', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('fetches orgs for a provider', async () => {
    const orgs = [{ slug: 'jane', name: 'jane', isPersonal: true }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => orgs } as Response)

    const result = await fetchOrgs('github')

    expect(result).toEqual(orgs)
    expect(fetch).toHaveBeenCalledWith('/api/projects/orgs?provider=github')
  })

  it('throws with server error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'github is not connected' }),
    } as Response)

    await expect(fetchOrgs('github')).rejects.toThrow('github is not connected')
  })
})

describe('fetchRepos', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('fetches repos with provider, org, and page', async () => {
    const page = { repos: [{ owner: 'acme', slug: 'widgets', defaultBranch: 'main' }], nextPage: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => page } as Response)

    const result = await fetchRepos('github', 'acme', 1)

    expect(result).toEqual(page)
    expect(fetch).toHaveBeenCalledWith('/api/projects/repos?provider=github&org=acme&page=1')
  })

  it('includes q param when a search term is given', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repos: [], nextPage: null }),
    } as Response)

    await fetchRepos('github', 'acme', 1, 'widg')

    expect(fetch).toHaveBeenCalledWith('/api/projects/repos?provider=github&org=acme&page=1&q=widg')
  })
})

describe('connectProject', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('posts provider/owner/repoSlug/defaultBranch and returns the created project', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => mockProject } as Response)

    const result = await connectProject('github', 'acme', 'widgets', 'main')

    expect(result).toEqual({ ok: true, project: mockProject })
    expect(fetch).toHaveBeenCalledWith('/api/projects/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'github', owner: 'acme', repoSlug: 'widgets', defaultBranch: 'main' }),
    })
  })

  it('returns ok:false with server error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'A project is already connected. Clear it first.' }),
    } as Response)

    const result = await connectProject('github', 'acme', 'widgets', 'main')

    expect(result).toEqual({ ok: false, error: 'A project is already connected. Clear it first.' })
  })
})

describe('clearProject', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('posts to /api/projects/clear', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ cleared: true }) } as Response)

    const result = await clearProject()

    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/projects/clear', { method: 'POST' })
  })
})

describe('syncProject', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('posts to /api/projects/sync and returns output', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, output: 'Already up to date.' }),
    } as Response)

    const result = await syncProject()

    expect(result).toEqual({ ok: true, output: 'Already up to date.' })
    expect(fetch).toHaveBeenCalledWith('/api/projects/sync', { method: 'POST' })
  })

  it('returns ok:false with server error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'network error' }),
    } as Response)

    const result = await syncProject()

    expect(result).toEqual({ ok: false, error: 'network error' })
  })
})
