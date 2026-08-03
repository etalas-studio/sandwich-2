import type { CreateTicketData } from '../components/CreateTicketModal'

export interface Ticket {
  key: string
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
  createdAt: string
  updatedAt: string
}

export async function createTicket(data: CreateTicketData): Promise<Ticket> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: data.id, description: data.description, url: data.url || null }),
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
