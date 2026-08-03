import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchIntegrations, connectIntegration, disconnectIntegration } from './integrations'
import type { IntegrationItem } from './integrations'

const mockIntegrations: IntegrationItem[] = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    connected: true,
    authType: 'api_key',
    models: [{ id: 'opencode-go/deepseek-v4', name: 'DeepSeek V4' }],
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    connected: false,
    authType: 'oauth',
    models: [],
  },
]

describe('fetchIntegrations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and returns integration status list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntegrations,
    } as Response)

    const result = await fetchIntegrations()

    expect(result).toEqual(mockIntegrations)
    expect(fetch).toHaveBeenCalledWith('/api/integrations')
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchIntegrations()).rejects.toThrow('HTTP 500')
  })
})

describe('connectIntegration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends apiKey and providerId to the connect endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, message: 'Connected' }),
    } as Response)

    const result = await connectIntegration('opencode-go', 'oc-secret')

    expect(result).toEqual({ ok: true, message: 'Connected' })
    expect(fetch).toHaveBeenCalledWith('/api/integrations/opencode-go/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: 'oc-secret' }),
    })
  })

  it('returns ok:false on server error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid key' }),
    } as Response)

    const result = await connectIntegration('opencode-go', 'bad-key')

    expect(result).toEqual({ ok: false, message: 'invalid key' })
  })

  it('falls back to HTTP status when server returns no error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const result = await connectIntegration('opencode-go', 'key')

    expect(result).toEqual({ ok: false, message: 'HTTP 500' })
  })
})

describe('disconnectIntegration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST to the disconnect endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, message: 'Disconnected' }),
    } as Response)

    const result = await disconnectIntegration('opencode-go')

    expect(result).toEqual({ ok: true, message: 'Disconnected' })
    expect(fetch).toHaveBeenCalledWith('/api/integrations/opencode-go/disconnect', {
      method: 'POST',
    })
  })

  it('returns ok:false on server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    } as Response)

    const result = await disconnectIntegration('opencode-go')

    expect(result).toEqual({ ok: false, message: 'server error' })
  })
})
