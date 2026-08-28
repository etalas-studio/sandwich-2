import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listProjects,
  renameProject,
  deleteProject,
  listConversationsGrouped,
} from './projects'

beforeEach(() => vi.restoreAllMocks())

describe('listProjects', () => {
  it('GETs /api/projects with credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'p1', userId: 'u1', title: 'X', createdAt: '', updatedAt: '' }],
    } as Response)
    const out = await listProjects()
    expect(out).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith('/api/projects', { credentials: 'include' })
  })
})

describe('renameProject', () => {
  it('PATCHes /api/projects/:id with a url-encoded id and {title} body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p 1', userId: 'u1', title: 'New', createdAt: '', updatedAt: '' }),
    } as Response)
    await renameProject('p 1', 'New')
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/projects/p%201')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toEqual({ title: 'New' })
  })
})

describe('deleteProject', () => {
  it('resolves on 204 without reading the body', async () => {
    const json = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 204, ok: true, json } as unknown as Response)
    await expect(deleteProject('p1')).resolves.toBeUndefined()
    expect(json).not.toHaveBeenCalled()
  })

  it('throws a specific error on 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 409, ok: false, json: async () => ({}) } as Response)
    await expect(deleteProject('p1')).rejects.toThrow('project still has conversations')
  })
})

describe('listConversationsGrouped', () => {
  it('hits ?groupBy=project and returns the group array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [{ project: { id: 'p1', title: 'X' }, conversations: [] }],
    } as Response)
    const out = await listConversationsGrouped()
    expect(out).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith('/api/conversations?groupBy=project', { credentials: 'include' })
  })
})
