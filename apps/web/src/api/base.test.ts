import { describe, it, expect, vi, afterEach } from 'vitest'

describe('apiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns path unchanged when VITE_API_URL is not set', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { apiUrl } = await import('./base')
    expect(apiUrl('/api/conversations')).toBe('/api/conversations')
  })

  it('prefixes path with VITE_API_URL when set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.spectr.id')
    // Re-import to pick up stubbed env
    vi.resetModules()
    const { apiUrl } = await import('./base')
    expect(apiUrl('/api/conversations')).toBe('https://api.spectr.id/api/conversations')
  })
})