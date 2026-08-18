import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMe, postLogin, postRegister, postLogout } from './auth'
import type { AuthState } from './auth'

// --------------- fetchMe ---------------

describe('fetchMe', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns authenticated state when server responds with authenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: 'authenticated', user: { id: 'u-alice', username: 'alice', email: 'alice@test.com' } }),
    } as Response)

    const result = await fetchMe()

    expect(result).toEqual<AuthState>({ status: 'authenticated', id: 'u-alice', username: 'alice', email: 'alice@test.com' })
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' })
  })

  it('returns unauthenticated state when server responds with unauthenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: 'unauthenticated' }),
    } as Response)

    const result = await fetchMe()

    expect(result).toEqual<AuthState>({ status: 'unauthenticated' })
  })

  it('throws when server responds with non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchMe()).rejects.toThrow('HTTP 500')
  })
})

// --------------- postLogin ---------------

describe('postLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends username and password as JSON to the login endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    await postLogin('alice', 'secret')

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'secret' }),
    })
  })

  it('throws with server error message on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid credentials' }),
    } as Response)

    await expect(postLogin('alice', 'wrong')).rejects.toThrow('invalid credentials')
  })

  it('throws with HTTP status when server returns no error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    await expect(postLogin('alice', 'secret')).rejects.toThrow('HTTP 500')
  })
})

// --------------- postRegister ---------------

describe('postRegister', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends username, email, and password as JSON to the register endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    await postRegister('alice', 'alice@example.com', 'secret')

    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'alice', email: 'alice@example.com', password: 'secret' }),
    })
  })

  it('throws with server error on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'username taken' }),
    } as Response)

    await expect(postRegister('alice', 'a@b.com', 'secret')).rejects.toThrow('username taken')
  })
})

// --------------- postLogout ---------------

describe('postLogout', () => {
  it('sends POST to the logout endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response)

    await postLogout()

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', credentials: 'include' })
  })
})
