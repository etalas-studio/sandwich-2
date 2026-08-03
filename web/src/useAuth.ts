import { useCallback, useEffect, useState } from 'react'

export type AuthState =
  | { status: 'loading' }
  | { status: 'setup_required' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; username: string }

interface MeResponse {
  state: 'setup_required' | 'unauthenticated' | 'authenticated'
  user?: { username: string }
}

async function fetchMe(): Promise<AuthState> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as MeResponse

  switch (data.state) {
    case 'authenticated':
      return { status: 'authenticated', username: data.user?.username ?? '' }
    case 'setup_required':
      return { status: 'setup_required' }
    case 'unauthenticated':
      return { status: 'unauthenticated' }
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `HTTP ${res.status}`)
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState(await fetchMe())
    } catch {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await postJson('/api/auth/register', { username, email, password })
      await refresh()
    },
    [refresh],
  )

  const login = useCallback(
    async (username: string, password: string) => {
      await postJson('/api/auth/login', { username, password })
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await refresh()
  }, [refresh])

  return { state, register, login, logout }
}
