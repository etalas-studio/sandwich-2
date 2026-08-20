import { apiUrl } from './base'
import { fetchMe } from './auth'

async function hasAuthenticatedUser(): Promise<boolean> {
  try {
    return (await fetchMe()).status === 'authenticated'
  } catch {
    return false
  }
}

export async function getPreference(key: string): Promise<string | null> {
  if (!await hasAuthenticatedUser()) return null
  const res = await fetch(apiUrl(`/api/preferences/${encodeURIComponent(key)}`), {
    credentials: 'include',
  })
  if (!res.ok) return null
  const data = (await res.json()) as { value: string | null }
  return data.value ?? null
}

export async function setPreference(key: string, value: string): Promise<void> {
  if (!await hasAuthenticatedUser()) return
  await fetch(apiUrl(`/api/preferences/${encodeURIComponent(key)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value }),
  })
}
