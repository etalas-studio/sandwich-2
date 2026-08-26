import { apiUrl } from './base'

export interface ProviderModel {
  id: string
  name: string
}

export interface IntegrationStatus {
  id: string
  name: string
  connected: boolean
  authType: 'api_key' | 'none'
  models: ProviderModel[]
  error?: string
  baseUrl?: string
  apiKey?: string
}

export interface EngineConfig {
  stages: Record<string, { provider: string; model: string; value: string }>
  defaults: Record<string, string>
  integrations: IntegrationStatus[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
  }
  return data
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function fetchAdminEngine(): Promise<EngineConfig> {
  return request<EngineConfig>(apiUrl('/api/admin/engine'))
}

export function updateAdminEngine(
  stages: Record<string, string>,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(apiUrl('/api/admin/engine'), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(stages),
  })
}

export function fetchIntegrations(): Promise<IntegrationStatus[]> {
  return request<IntegrationStatus[]>(apiUrl('/api/admin/integrations'))
}

export function connectProvider(
  providerId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(apiUrl(`/api/admin/integrations/${providerId}/connect`), {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  })
}

export function testProvider(
  providerId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(apiUrl(`/api/admin/integrations/${providerId}/test`), {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  })
}

export function pingProvider(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(apiUrl(`/api/admin/integrations/${providerId}/ping`), {})
}

export function disconnectProvider(
  providerId: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(apiUrl(`/api/admin/integrations/${providerId}/disconnect`), {})
}
