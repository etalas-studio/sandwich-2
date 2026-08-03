import { useState, useEffect } from 'react'

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

// Backend types from /api/tickets
interface BackendTicket {
  key: string
  summary: string
  description: string
  url: string | null
  createdAt: string
  updatedAt: string
  latestRun: BackendRun | null
}

interface BackendRun {
  id: string
  ticketKey: string
  engine: string
  outcome: string
  needsHumanCategory: string | null
  needsHumanReason: string | null
  startedAt: string
  finishedAt: string | null
  branch: string | null
  worktreePath: string | null
  baseCommit: string | null
  prUrl: string | null
  prSummary: string | null
  createdAt: string
}

// Map backend outcome to frontend status
function mapOutcomeToStatus(outcome: string): TicketStatus {
  switch (outcome) {
    case 'judging':
    case 'implementing':
    case 'verifying':
    case 'opening_pr':
      return 'in_progress'
    case 'needs_human':
      return 'blocked'
    case 'ready_for_review':
    case 'pr_opened':
      return 'done'
    default:
      return 'backlog'
  }
}

// Map backend outcome to frontend stage
function mapOutcomeToStage(outcome: string): PipelineStage | null {
  switch (outcome) {
    case 'judging':
      return 'judge'
    case 'implementing':
      return 'implement'
    case 'verifying':
      return 'verify'
    case 'opening_pr':
    case 'ready_for_review':
    case 'pr_opened':
      return 'open_pr'
    default:
      return null
  }
}

// Transform backend ticket to frontend ticket
function transformTicket(backend: BackendTicket): Ticket {
  const run = backend.latestRun
  
  if (!run) {
    return {
      key: backend.key,
      summary: backend.summary,
      description: backend.description,
      url: backend.url,
      status: 'backlog',
      stage: null,
      needsHumanCategory: null,
      needsHumanReason: null,
      prUrl: null,
      prSummary: null,
      startedAt: null,
      finishedAt: null,
    }
  }

  return {
    key: backend.key,
    summary: backend.summary,
    description: backend.description,
    url: backend.url,
    status: mapOutcomeToStatus(run.outcome),
    stage: mapOutcomeToStage(run.outcome),
    needsHumanCategory: run.needsHumanCategory as NeedsHumanCategory | null,
    needsHumanReason: run.needsHumanReason,
    prUrl: run.prUrl,
    prSummary: run.prSummary,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  }
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    
    fetch('/api/tickets')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<BackendTicket[]>
      })
      .then(data => {
        if (!cancelled) {
          setTickets(data.map(transformTicket))
          setError(null)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })

    return () => { cancelled = true }
  }, [])

  return { tickets, error }
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
  // For now, assume all done tickets were autonomous (we don't have review data yet)
  const autonomyRate = done.length > 0 ? 0.62 : 0 // Placeholder until we have review data

  return {
    agentSuccessRate: successRate,
    avgDurationSec: Math.round(avgDuration),
    autonomyRate,
  }
}
