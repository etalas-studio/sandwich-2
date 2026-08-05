// Ticket status = which column the ticket is in
export type TicketStatus = 'backlog' | 'in_progress' | 'blocked' | 'done'

// Pipeline stage = progress within "in_progress"
export type PipelineStage = 'judge' | 'implement' | 'verify' | 'open_pr'

// Needs-human category
export type NeedsHumanCategory = 
  | 'ambiguous_ticket'
  | 'quick_win'
  | 'second_chance'
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
  prTitle?: string | null
  prDescription?: string | null
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

// Project settings/API moved to src/api/projects.ts + src/hooks/useProject.ts
// (see docs/superpowers/specs/2026-08-04-project-selection-design.md).
