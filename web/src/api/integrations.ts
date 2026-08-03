export interface IntegrationItem {
  id: string
  name: string
  connected: boolean
  authType: 'api_key' | 'oauth' | 'none'
  models: Array<{ id: string; name: string }>
  error?: string
}

export async function fetchIntegrations(): Promise<IntegrationItem[]> {
  const res = await fetch('/api/integrations')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<IntegrationItem[]>
}

export async function connectIntegration(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(
    `/api/integrations/${encodeURIComponent(providerId)}/connect`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    },
  )
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; message?: string; error?: string }
    | null
  if (res.ok && body?.ok) return { ok: true, message: body.message ?? 'Connected' }
  return { ok: false, message: body?.message ?? body?.error ?? `HTTP ${res.status}` }
}

export async function disconnectIntegration(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(
    `/api/integrations/${encodeURIComponent(providerId)}/disconnect`,
    { method: 'POST' },
  )
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; message?: string; error?: string }
    | null
  if (res.ok && body?.ok) return { ok: true, message: body.message ?? 'Disconnected' }
  return { ok: false, message: body?.message ?? body?.error ?? `HTTP ${res.status}` }
}
