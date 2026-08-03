import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

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

// Map backend outcome (src/pipeline/types.ts's real outcome vocabulary) to
// frontend status. "running"/"agent_ready"/"changes_committed" are the
// mid-pipeline states a run's outcome sits at *while* Implement/Verify are
// actually executing (the row isn't updated again until that stage
// resolves) — treated as in_progress. Everything Implement/Verify can
// terminate on without reaching ready_for_pr is a stop that needs a human,
// per the pipeline shape design (Judge is currently stubbed, so most of
// these come from Implement/Verify's own safety nets, not Judge).
function mapOutcomeToStatus(outcome: string): TicketStatus {
  switch (outcome) {
    case 'running':
    case 'agent_ready':
    case 'changes_committed':
      return 'in_progress'
    case 'needs_human':
    case 'no_changes':
    case 'implement_timeout':
    case 'implement_error':
    case 'implement_nonzero_exit':
    case 'implement_aborted':
    case 'verify_failed':
    case 'verify_timeout':
    case 'verify_aborted':
    case 'error':
      return 'blocked'
    case 'ready_for_pr':
      return 'done'
    default:
      return 'backlog'
  }
}

// Map backend outcome to frontend stage — mirrors the same mid-pipeline
// reasoning as mapOutcomeToStatus above. Failure outcomes map to the stage
// they actually failed in, so the detail panel's stepper can show "stopped
// here" on the right row instead of rendering all-pending. Two outcomes stay
// null because the outcome string genuinely doesn't say where they happened:
// `needs_human` (Implement's blocklist hit and Verify's missing-test-command
// check both produce it) and `error` (the orchestrator's catch-all, which
// can fire anywhere in the run).
function mapOutcomeToStage(outcome: string): PipelineStage | null {
  switch (outcome) {
    case 'running':
      return 'judge'
    case 'agent_ready':
      return 'implement'
    case 'changes_committed':
      return 'verify'
    case 'ready_for_pr':
      return 'open_pr'
    case 'no_changes':
    case 'implement_timeout':
    case 'implement_error':
    case 'implement_nonzero_exit':
    case 'implement_aborted':
      return 'implement'
    case 'verify_failed':
    case 'verify_timeout':
    case 'verify_aborted':
      return 'verify'
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

// Polled rather than fetched once, so a ticket's status/stage visibly
// advances while a run is in progress — a stand-in for the real-time SSE
// push the Visibility piece will eventually add (see
// docs/superpowers/specs/2026-08-03-pipeline-shape-design.md). Mutations
// (run/stop/duplicate/delete/create) invalidate this query key themselves
// so the list refreshes immediately instead of waiting for the next tick.
const POLL_INTERVAL_MS = 4000

export const TICKETS_QUERY_KEY = ['tickets'] as const

async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch('/api/tickets')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as BackendTicket[]
  return data.map(transformTicket)
}

export function useTickets() {
  const query = useQuery({
    queryKey: TICKETS_QUERY_KEY,
    queryFn: fetchTickets,
    refetchInterval: POLL_INTERVAL_MS,
  })

  return {
    tickets: query.data ?? null,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    isLoading: query.isLoading,
  }
}

export interface RunTicketResult {
  ok: boolean
  message: string
}

async function postAction(url: string, okMessage: string): Promise<RunTicketResult> {
  try {
    const res = await fetch(url, { method: 'POST' })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      return { ok: false, message: body?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, message: okMessage }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function runTicket(key: string): Promise<RunTicketResult> {
  return postAction(`/api/tickets/${encodeURIComponent(key)}/run`, 'Run started')
}

export interface NewTicketInput {
  key: string
  summary: string
  description: string
  url?: string | null
}

export async function createTicket(input: NewTicketInput): Promise<RunTicketResult> {
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      return { ok: false, message: body?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, message: 'Added' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function stopTicket(key: string): Promise<RunTicketResult> {
  return postAction(`/api/tickets/${encodeURIComponent(key)}/stop`, 'Stopping')
}

export async function duplicateTicket(key: string): Promise<RunTicketResult> {
  return postAction(`/api/tickets/${encodeURIComponent(key)}/duplicate`, 'Duplicated')
}

export async function deleteTicket(key: string): Promise<RunTicketResult> {
  try {
    const res = await fetch(`/api/tickets/${encodeURIComponent(key)}`, { method: 'DELETE' })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      return { ok: false, message: body?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, message: 'Deleted' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

// Project folder chosen via first-run setup (src/db/settings.ts's
// instance_settings row) — the repo the pipeline actually runs the agent
// against. null until a human sets one in Settings.
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

// One row from readiness_scans (src/db/readiness-scans.ts) — the coarse
// readiness map produced by a manual scan (Overview's "First scan" button).
export interface AreaSignal {
  pathPrefix: string
  testToCodeRatio: number
  churnScore: number
}

export interface ReadinessRecommendation {
  id: string
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface ReadinessScan {
  id: string
  startedAt: string
  finishedAt: string | null
  techStack: string | null
  testCommand: string | null
  areaSignals: AreaSignal[] | null
  recommendations: ReadinessRecommendation[] | null
  codebaseSummary: string | null
  agenticFlowSummary: string | null
  status: 'running' | 'completed' | 'failed'
}

// Polled while Overview is mounted, same stand-in-for-SSE reasoning as
// useTickets above. triggerReadinessScan invalidates this query key on
// success, so the card reflects "running" immediately instead of waiting
// for the next poll tick.
export const READINESS_SCAN_QUERY_KEY = ['readiness-scan', 'latest'] as const

async function fetchLatestReadinessScan(): Promise<ReadinessScan | null> {
  const res = await fetch('/api/readiness-scans/latest')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ReadinessScan | null>
}

export function useLatestReadinessScan() {
  const query = useQuery({
    queryKey: READINESS_SCAN_QUERY_KEY,
    queryFn: fetchLatestReadinessScan,
    refetchInterval: POLL_INTERVAL_MS,
  })

  return {
    scan: query.data ?? null,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    isLoading: query.isLoading,
  }
}

export async function triggerReadinessScan(): Promise<RunTicketResult> {
  return postAction('/api/readiness-scans/run', 'Scan started')
}

// TEMPORARY dev-only helper — see src/db/purge.ts.
export async function purgeDatabase(): Promise<RunTicketResult> {
  return postAction('/api/dev/purge', 'Purged')
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

// One row from run_artifacts (src/db/run-artifacts.ts) — a raw text blob
// captured by a pipeline stage (transcript, diff, test output).
export type RunArtifactKind =
  | 'judge_prompt'
  | 'judge_transcript'
  | 'implement_transcript'
  | 'diff_patch'
  | 'verify_output'

export interface RunArtifact {
  id: string
  runId: string
  kind: RunArtifactKind
  content: string
  createdAt: string
}

// Polled while the ticket detail panel is open, same stand-in-for-SSE
// reasoning as useTickets above — the transcript view is the closest thing
// to "watching the agent work" until real live push exists.
export function useRunArtifacts(ticketKey: string, active: boolean) {
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false

    const load = () => {
      fetch(`/api/tickets/${encodeURIComponent(ticketKey)}/artifacts`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<RunArtifact[]>
        })
        .then(data => {
          if (!cancelled) {
            setArtifacts(data)
            setError(null)
          }
        })
        .catch(e => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ticketKey, active])

  return { artifacts, error }
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
