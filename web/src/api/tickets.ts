import type { CreateTicketData } from '../components/CreateTicketModal'

export interface Ticket {
  key: string
  summary: string
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
    body: JSON.stringify(data),
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
