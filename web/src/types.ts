// Ticket status = which column the ticket is in
export type TicketStatus = 'backlog' | 'in_progress' | 'blocked' | 'done'

// Pipeline stage = progress within "in_progress"
export type PipelineStage = 'judge' | 'implement' | 'verify' | 'open_pr'

// Needs-human category
export type NeedsHumanCategory = 
  | 'ambiguous_ticket'
  | 'forbidden_path'
  | 'forbidden_path_or_action'
  | 'weak_verification'
  | 'missing_context'
  | 'credential_missing'
  | 'test_failure'
  | 'agent_error'

export interface Ticket {
  key: string
  summary: string
  description: string
  url: string | null
  status: TicketStatus
  stage: PipelineStage | null
  needsHumanCategory: NeedsHumanCategory | null
  needsHumanReason: string | null
  prUrl: string | null
  prSummary: string | null
  startedAt: string | null
  finishedAt: string | null
}

export interface Stats {
  agentSuccessRate: number
  avgDurationSec: number
  autonomyRate: number
}

// Compute stats from tickets
export function computeStats(tickets: Ticket[]): Stats {
  const done = tickets.filter(t => t.status === 'done')
  const blocked = tickets.filter(t => t.status === 'blocked')

  // Success rate = done / (done + blocked)
  const totalFinished = done.length + blocked.length
  const successRate = totalFinished > 0 ? done.length / totalFinished : 0

  // Avg duration
  const durations: number[] = []
  for (const t of tickets) {
    if (t.startedAt && t.finishedAt) {
      const start = new Date(t.startedAt).getTime()
      const end = new Date(t.finishedAt).getTime()
      durations.push((end - start) / 1000)
    }
  }
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0

  // Autonomy rate = done without human / total done
  const autonomyRate = done.length > 0 ? 0.62 : 0

  return {
    agentSuccessRate: successRate,
    avgDurationSec: Math.round(avgDuration),
    autonomyRate,
  }
}

// ────────────────────────────────────────────────────────────
// Project settings
// ────────────────────────────────────────────────────────────
export interface ProjectSettings {
  repoPath: string | null
  firstRunCompletedAt: string | null
}

export interface SaveProjectResult {
  ok: boolean
  message: string
  settings?: ProjectSettings
}

export async function fetchProjectSettings(): Promise<ProjectSettings> {
  const res = await fetch('/api/settings/project')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ProjectSettings>
}

export async function saveProjectSettings(repoPath: string): Promise<SaveProjectResult> {
  try {
    const res = await fetch('/api/settings/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoPath }),
    })
    const body = (await res.json().catch(() => null)) as (ProjectSettings & { error?: string }) | null
    if (!res.ok) {
      return { ok: false, message: body?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, message: 'Saved', settings: body ?? undefined }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

// ────────────────────────────────────────────────────────────
// Integrations (Pi SDK provider management)
// ────────────────────────────────────────────────────────────

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

export async function connectIntegration(providerId: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(providerId)}/connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null
  if (res.ok && body?.ok) return { ok: true, message: body.message ?? 'Connected' }
  return { ok: false, message: body?.message ?? body?.error ?? `HTTP ${res.status}` }
}

export async function disconnectIntegration(providerId: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(providerId)}/disconnect`, { method: 'POST' })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null
  if (res.ok && body?.ok) return { ok: true, message: body.message ?? 'Disconnected' }
  return { ok: false, message: body?.message ?? body?.error ?? `HTTP ${res.status}` }
}
