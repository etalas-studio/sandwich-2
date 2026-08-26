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

// ── Admin stats ───────────────────────────────────────────────────────────

export interface AdminStatsPayment {
  orderId: string
  userEmail: string | null
  planSlug: string | null
  grossAmount: string
  transactionStatus: string
  fraudStatus: string | null
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  activeProSubs: number
  starterUsers: number
  revenueThisMonth: number
  usageThisMonth: { doc: number; prototype: number; chat: number }
  recentPayments: AdminStatsPayment[]
  docsByType: { prd: number; quotation: number; prototype: number; specs: number }
  paymentFunnel: { initiated: number; settled: number; failed: number }
  expiringSubsCount: number
  newUsersThisMonth: number
  newUsersLastMonth: number
}

export interface AdminUser {
  id: string
  email: string
  username: string
  role: string
  emailVerified: boolean
  createdAt: string
  subscription: { planSlug: string; status: string; expiresAt: string | null } | null
  usageThisMonth: { doc: number; prototype: number; chat: number }
}

export interface AdminUsersResponse {
  users: AdminUser[]
  total: number
  page: number
}

export function fetchAdminStats(): Promise<AdminStats> {
  return request<AdminStats>(apiUrl('/api/admin/stats'))
}

export function fetchAdminUsers(
  page = 1,
  limit = 50,
  search?: string,
  role?: string,
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  if (role) params.set('role', role)
  return request<AdminUsersResponse>(apiUrl(`/api/admin/users?${params}`))
}

export function setUserRole(
  userId: string,
  role: 'user' | 'admin',
): Promise<{ ok: boolean }> {
  return postJson(apiUrl(`/api/admin/users/${userId}/role`), { role })
}

export function deleteAdminUser(userId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(apiUrl(`/api/admin/users/${userId}`), { method: 'DELETE' })
}

export function manageUserSubscription(
  userId: string,
  action: 'cancel' | 'grant',
  planSlug?: string,
): Promise<{ ok: boolean }> {
  return postJson(apiUrl(`/api/admin/users/${userId}/subscription`), {
    action,
    ...(planSlug ? { planSlug } : {}),
  })
}
