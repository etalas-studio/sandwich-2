export type TicketType = 'prd' | 'mom' | 'quotation' | 'specs' | 'prototype' | 'workflow' | 'general'

export interface LocalTicket {
  id: string
  summary: string
  description: string
  createdAt: string
  type: TicketType
  content?: string  // AI-generated output stored here
  status: 'draft' | 'processing' | 'done'
}

const KEY = 'sandwich_tickets'

export function getTickets(): LocalTicket[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LocalTicket[] }
  catch { return [] }
}

export function saveTicket(ticket: LocalTicket): void {
  const all = getTickets()
  all.unshift(ticket)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function updateTicket(id: string, patch: Partial<LocalTicket>): void {
  const all = getTickets()
  const idx = all.findIndex(t => t.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...patch }
    localStorage.setItem(KEY, JSON.stringify(all))
  }
}

export function deleteTicket(id: string): void {
  const all = getTickets().filter(t => t.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
}
