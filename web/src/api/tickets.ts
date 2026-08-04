import type { CreateTicketData } from '../components/CreateTicketModal'

export interface Ticket {
  key: string
  summary: string | null
  description: string
  url: string | null
  status: string
  stage: string | null
  needsHumanCategory: string | null
  needsHumanReason: string | null
  prUrl: string | null
  prSummary: string | null
  startedAt: string | null
  finishedAt: string | null
  quickWinChoices: string | null
  quickWinAttempts: number
  createdAt: string
  updatedAt: string
  // Jira metadata (informational)
  issueType: string | null
  priority: string | null
  sprint: string | null
  storyPoints: number | null
  team: string | null
  assignee: string | null
  parentKey: string | null
  attachments: string | null
  jiraStatus: string | null
}

export async function createTicket(data: CreateTicketData): Promise<Ticket> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: data.id, summary: data.summary, description: data.description, url: data.url || null }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<Ticket>
}

export async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch('/api/tickets')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<Ticket[]>
}

export interface UpdateTicketData {
  summary?: string | null
  description?: string
  url?: string | null
  status?: string
}

export async function updateTicket(key: string, data: UpdateTicketData): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<Ticket>
}

export async function deleteTicket(key: string): Promise<void> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
}

export interface QuickWinChoice {
  label: string
  description: string
  inject: string
}

export async function resolveTicket(key: string, choiceIndex: number, modelId?: string): Promise<void> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(key)}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ choiceIndex, ...(modelId ? { modelId } : {}) }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
}

export async function runTicket(key: string, modelId?: string): Promise<void> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(key)}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(modelId ? { modelId } : {}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
}

export interface PullResult {
  ok: boolean
  imported: number
  skipped: number
  error?: string
}

export async function pullJiraTickets(): Promise<PullResult> {
  const res = await fetch('/api/tickets/pull', { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as PullResult | null
    return body ?? { ok: false, imported: 0, skipped: 0, error: `HTTP ${res.status}` }
  }
  return res.json() as Promise<PullResult>
}
