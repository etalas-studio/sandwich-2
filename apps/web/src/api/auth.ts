import { apiUrl } from './base'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; username: string }

interface MeResponse {
  state: 'unauthenticated' | 'authenticated'
  user?: { username: string }
}

export async function fetchMe(): Promise<AuthState> {
  const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as MeResponse

  switch (data.state) {
    case 'authenticated':
      return { status: 'authenticated', username: data.user?.username ?? '' }
    case 'unauthenticated':
      return { status: 'unauthenticated' }
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `HTTP ${res.status}`)
  }
}

export async function postLogin(username: string, password: string): Promise<void> {
  await postJson(apiUrl('/api/auth/login'), { username, password })
}

export async function postRegister(
  username: string,
  email: string,
  password: string,
): Promise<void> {
  await postJson(apiUrl('/api/auth/register'), { username, email, password })
}

export async function postLogout(): Promise<void> {
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
}

export async function postForgotPassword(email: string): Promise<void> {
  await postJson(apiUrl('/api/auth/forgot-password'), { email })
}

export async function postResetPassword(token: string, newPassword: string): Promise<void> {
  await postJson(apiUrl('/api/auth/reset-password'), { token, newPassword })
}
