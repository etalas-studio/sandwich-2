import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { Toaster, toast } from 'sonner'
import type { Ticket } from './api/tickets'
import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import KanbanBoard from './components/KanbanBoard'
import TicketDetail from './components/TicketDetail'
import Settings from './components/Settings'
import Integrations from './components/Integrations'
import { Link } from 'react-router-dom'
import ModelSelector from './components/ModelSelector'
import CreateTicketModal from './components/CreateTicketModal'
import type { CreateTicketData } from './components/CreateTicketModal'
import EditTicketModal from './components/EditTicketModal'
import ConfirmDeleteModal from './components/ConfirmDeleteModal'
import type { UpdateTicketData } from './api/tickets'
import { createTicket as apiCreateTicket, fetchTickets, updateTicket as apiUpdateTicket, deleteTicket as apiDeleteTicket } from './api/tickets'
import { computeStats } from './types'
import { ModelProvider, useModelContext } from './contexts/ModelContext'
import ReadinessCard from './components/ReadinessCard'
import { useProjectSettings } from './hooks/useProjectSettings'
import { useScan } from './hooks/useScan'

function OverviewPage() {
  const { repoPath } = useProjectSettings()
  const { latestScan, isRunning, isTriggering, isAborting, trigger, abort } = useScan()
  const { selectedModelId } = useModelContext()

  const hasProject = !!repoPath
  const hasModel = !!selectedModelId
  const hasScan = latestScan && latestScan.status !== 'running'

  const scanButtonLabel = isRunning
    ? 'Scanning…'
    : hasScan
      ? 'Re-scan'
      : 'Project Scan'

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
              Overview
            </h1>
          </div>
          <p className="text-sm text-white/50 font-light">
            How AI-ready this project is, at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ModelSelector />
          {isRunning ? (
            <button
              type="button"
              onClick={abort}
              disabled={isAborting}
              className="px-4 py-2 text-xs text-[#ff8a8a] bg-[#ff8a8a]/5 hover:bg-[#ff8a8a]/10 rounded-lg border border-[#ff8a8a]/20 transition-colors font-light flex items-center gap-2"
            >
              <iconify-icon icon="solar:stop-circle-linear" width="14" />
              {isAborting ? 'Aborting…' : 'Abort'}
            </button>
          ) : (
            <button
              type="button"
              onClick={trigger}
              disabled={!hasProject || !hasModel || isTriggering}
              className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
              title={!hasProject ? 'Set a project path in Settings first' : !hasModel ? 'Select a model from the dropdown' : undefined}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span
                className="relative flex items-center gap-2 px-5 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                style={{
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6), 0 4px 8px -2px rgba(0,0,0,0.6)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                <iconify-icon icon="solar:radar-linear" width="14" className="text-white/80" />
                {isTriggering ? 'Starting…' : scanButtonLabel}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── No project configured ── */}
      {!hasProject && (
        <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10 text-center py-6">
              <p className="text-sm text-white/50 font-light mb-3">
                No project configured yet.
              </p>
              <Link
                to="/settings"
                className="text-xs text-white/60 hover:text-white transition-colors underline underline-offset-4"
              >
                Set a repository path in Settings →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan running ── */}
      {(isRunning || isTriggering) && (
        <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4">
              <iconify-icon
                icon="solar:refresh-linear"
                width="20"
                className="text-white/60 animate-spin shrink-0"
              />
              <div>
                <p className="text-sm text-white font-light">
                  {isTriggering ? 'Starting project scan…' : 'Project scan in progress…'}
                </p>
                <p className="text-xs text-white/40 font-light mt-1">
                  {isTriggering
                    ? 'Initializing…'
                    : 'Analyzing codebase structure, tech stack, test coverage, and churn. This may take a minute.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan failed ── */}
      {latestScan && latestScan.status === 'failed' && !isRunning && (
        <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10 text-center py-4">
              <p className="text-sm text-[#ff8a8a] font-light mb-1">
                Project scan failed.
              </p>
              <p className="text-xs text-white/40 font-light">
                Check that a model is selected and the provider is connected in Settings → Integrations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan results ── */}
      {hasScan && latestScan?.status === 'completed' && !isRunning && !isTriggering && (
        <ReadinessCard scan={latestScan!} />
      )}

      {/* ── Project not yet scanned ── */}
      {hasProject && !hasScan && !isRunning && !isTriggering && (
        <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10 text-center py-6">
              <p className="text-sm text-white/50 font-light">
                Run a project scan to analyze the codebase and detect its tech stack, test coverage, and churn per area.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Agentic Readiness + Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Agentic Readiness */}
        <div>
          <div className="section-label">Agentic Readiness</div>
          <div className="ds-card-outer ds-shadow-elevated" style={{ height: 'auto' }}>
            <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
              <div className="absolute inset-0 ds-noise pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] text-[10px] font-normal tracking-wide border border-[#5a4525]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
                      Pending
                    </span>
                    <span className="text-xs text-white/40 font-light">Run a scan to populate</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }}>
                    <div className="h-full bg-gradient-to-r from-white/10 to-white/20 rounded-full w-[0%]" />
                  </div>
                </div>

                <p className="text-sm text-white/50 font-light leading-relaxed mb-5">
                  After scanning, this card will show how ready your project is for AI agents —
                  which signals are present, what needs attention, and what's missing.
                </p>

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#8affb1]" style={{ boxShadow: '0 0 6px rgba(138,255,177,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#8affb1] uppercase">What's strong</span>
                  </div>
                  <FindingItem
                    icon="solar:document-text-linear"
                    title="CLAUDE.md"
                    detail="Well-structured English project context with working rules, file map, and decision rationale. The single most valuable file for an AI entering this codebase."
                  />
                  <FindingItem
                    icon="solar:map-point-linear"
                    title="Roadmap & specs"
                    detail="docs/roadmap.md tracks every phase with checkboxes; design specs and implementation plans give agents detailed guidance for any task."
                  />
                </div>

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#f59e0b]" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#f59e0b] uppercase">Needs attention</span>
                  </div>
                  <FindingItem
                    icon="solar:translation-linear"
                    title="README.md is in Indonesian"
                    detail="Most AI coding models perform best with English project context. The README is thorough but an English version would significantly improve first-read comprehension."
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#ff8a8a]" style={{ boxShadow: '0 0 6px rgba(255,138,138,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#ff8a8a] uppercase">Missing</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <FindingItem
                      icon="solar:structure-linear"
                      title="architecture.md"
                      detail="No document describing pipeline stages, data flow, or how subsystems connect. Agents must infer structure from source."
                    />
                    <FindingItem
                      icon="solar:mention-circle-linear"
                      title="AGENTS.md"
                      detail="No project-specific AI instructions. Conventions like no-shell-in-proc.ts and append-only records are only in CLAUDE.md's working rules."
                    />
                    <FindingItem
                      icon="solar:users-group-rounded-linear"
                      title="CONTRIBUTING.md"
                      detail="No contributor guide. Agents and humans alike have no documented workflow for branching, commits, or review expectations."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <div className="section-label">Recommendations</div>
          <div className="ds-card-outer ds-shadow-elevated" style={{ height: 'auto' }}>
            <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
              <div className="absolute inset-0 ds-noise pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-1">
                <RecommendationItem
                  icon="solar:translation-linear"
                  title="Translate README.md to English"
                  description="AI coding agents parse English project context more reliably. An English README alongside the existing Indonesian one (or replacing it) would improve first-read comprehension for any agent entering this codebase."
                />
                <RecommendationItem
                  icon="solar:structure-linear"
                  title="Add an architecture.md"
                  description="Document the pipeline stages, data flow between orchestrator and worktrees, and how guardrails, credential storage, and the web server fit together. This gives agents a structural map before they start reading source files."
                />
                <RecommendationItem
                  icon="solar:mention-circle-linear"
                  title="Add AGENTS.md with project-specific rules"
                  description="An AGENTS.md (or .cursorrules) file tells AI agents about conventions unique to this project: no shell in proc.ts, append-only run records, the credential store pattern, and the working rules from CLAUDE.md that agents should follow."
                />
                <RecommendationItem
                  icon="solar:users-group-rounded-linear"
                  title="Add CONTRIBUTING.md"
                  description="Helps both human contributors and AI agents understand the contribution workflow: branch naming, commit conventions, how to run tests, and what the review process expects."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Area Signals ── */}
      <div className="section-label">Area Signals</div>
      <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
        <div className="ds-card-inner overflow-hidden" style={{ height: 'auto' }}>
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/[0.04] bg-[#0a0a0a]/50">
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Area</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Files</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Test Coverage</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Churn</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                <AreaRow
                  area="src/pipeline"
                  files={2}
                  coverage={50}
                  churn={66}
                  note="Core orchestration. Light on tests relative to churn — actively being built."
                />
                <AreaRow
                  area="src/db"
                  files={9}
                  coverage={56}
                  churn={63}
                  note="Storage layer. Migrations and migrate.ts untested; repos are well-covered."
                />
                <AreaRow
                  area="src/engine"
                  files={7}
                  coverage={57}
                  churn={20}
                  note="Agent invocation. Manual-check files and proc.ts lack direct tests."
                />
                <AreaRow
                  area="src/auth"
                  files={4}
                  coverage={75}
                  churn={15}
                  note="Session auth with CSRF. Only middleware.ts lacks a direct test."
                />
                <AreaRow
                  area="src/web-server.ts"
                  files={1}
                  coverage={100}
                  churn={3}
                  note="HTTP server entry point. Single file, fully tested."
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  )
}

/* ── Finding item (used in Agentic Readiness) ── */

function FindingItem({
  icon,
  title,
  detail,
}: {
  icon: string
  title: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
      <iconify-icon icon={icon} width="14" className="text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-xs text-white/70 font-normal">{title}</span>
        <p className="text-[11px] text-white/35 font-light mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </div>
  )
}

/* ── Recommendation list item ── */

function RecommendationItem({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
      <iconify-icon icon={icon} width="16" className="text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-sm text-white/80 font-light">{title}</span>
        <p className="text-xs text-white/40 font-light mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

/* ── Area signal table row ── */

function AreaRow({
  area,
  files,
  coverage,
  churn,
  note,
}: {
  area: string
  files: number
  coverage: number
  churn: number
  note: string
}) {
  const coverageColor = coverage >= 70 ? 'text-[#8affb1]' : coverage >= 40 ? 'text-[#f59e0b]' : 'text-[#ff8a8a]'
  const coverageBg = coverage >= 70 ? 'bg-[#8affb1]' : coverage >= 40 ? 'bg-[#f59e0b]' : 'bg-[#ff8a8a]'

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-6 py-3.5 text-white/80 font-mono text-xs">{area}</td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs">{files}</td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 max-w-20 h-1 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }}>
            <div className={`h-full rounded-full ${coverageBg}`} style={{ width: `${coverage}%`, boxShadow: coverage >= 70 ? '0 0 6px rgba(138,255,177,0.3)' : coverage >= 40 ? '0 0 6px rgba(245,158,11,0.3)' : '0 0 6px rgba(255,138,138,0.3)' }} />
          </div>
          <span className={`text-xs font-mono font-light ${coverageColor}`}>{coverage}%</span>
        </div>
      </td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs font-mono">{churn}</td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs max-w-64 leading-relaxed">{note}</td>
    </tr>
  )
}

function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Create state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Edit state
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Delete state
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    try {
      setLoadError(null)
      const data = await fetchTickets()
      setTickets(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTickets() }, [loadTickets])

  const selectedKey = searchParams.get('selected')
  const selectedTicket = selectedKey
    ? tickets.find(t => t.key === selectedKey) ?? null
    : null

  const handleOpenTicket = (ticket: Ticket) => {
    setSearchParams({ selected: ticket.key })
  }

  const handleCloseTicket = () => {
    setSearchParams({})
  }

  const handleCreate = async (data: CreateTicketData) => {
    setCreateError(null)
    setIsCreating(true)
    try {
      await apiCreateTicket(data)
      setShowCreateModal(false)
      toast.success(`Ticket ${data.id || '(auto-generated)'} created`)
      await loadTickets()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create ticket')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async (key: string, data: UpdateTicketData) => {
    setEditError(null)
    setIsUpdating(true)
    try {
      await apiUpdateTicket(key, data)
      setEditingTicket(null)
      toast.success(`Ticket ${key} updated`)
      await loadTickets()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update ticket')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingKey) return
    try {
      await apiDeleteTicket(deletingKey)
      toast.success(`Ticket ${deletingKey} deleted`)
      setDeletingKey(null)
      if (selectedKey === deletingKey) setSearchParams({})
      await loadTickets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete ticket')
      setDeletingKey(null)
    }
  }

  return (
    <>
      <div className="h-full overflow-y-auto hide-scrollbar p-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
                Tickets
              </h1>
            </div>
            <p className="text-sm text-white/50 font-light">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {tickets.length} tickets
            </p>
          </div>
          <button
            className="relative inline-flex group"
            onClick={() => { setCreateError(null); setShowCreateModal(true) }}
          >
            <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
            <span
              className="relative flex items-center gap-2 px-5 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6), 0 4px 8px -2px rgba(0,0,0,0.6)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              <iconify-icon icon="solar:add-circle-linear" width="14" className="text-white/80" />
              Add Ticket
            </span>
          </button>
        </div>

        <StatsCards stats={computeStats(tickets as any)} />

        {loading ? (
          <p className="text-sm text-white/40">Loading tickets…</p>
        ) : loadError ? (
          <p className="text-sm text-[#ff8a8a]">{loadError}</p>
        ) : (
          <>
            <KanbanBoard
              tickets={tickets}
              onOpenTicket={handleOpenTicket}
            />
          </>
        )}
      </div>

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={handleCloseTicket}
          onEdit={() => { setEditError(null); setEditingTicket(selectedTicket) }}
          onDelete={() => setDeletingKey(selectedTicket.key)}
        />
      )}

      <CreateTicketModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        error={createError}
        isPending={isCreating}
      />

      {editingTicket && (
        <EditTicketModal
          open={true}
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSubmit={handleUpdate}
          error={editError}
          isPending={isUpdating}
        />
      )}

      {deletingKey && (
        <ConfirmDeleteModal
          open={true}
          itemName={deletingKey}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeletingKey(null)}
        />
      )}
    </>
  )
}

interface AppProps {
  username: string
  onLogout: () => void
}

function AppLayout({ username, onLogout }: AppProps) {
  return (
    <ModelProvider>
    <div className="ds-bg min-h-screen text-white antialiased">
      <Toaster theme="dark" position="top-right" />
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[30%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-white/5 blur-[100px]"
          style={{ animation: 'pulse 6s ease-in-out infinite' }}
        />
        <div
          className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[40vw] h-[70vh] bg-gradient-to-b from-white/5 via-white/[0.02] to-transparent blur-[80px]"
          style={{ animation: 'pulse 6s ease-in-out infinite', animationDelay: '3s' }}
        />
      </div>

      <div className="ds-card-outer min-h-screen">
        <div className="ds-card-inner flex min-h-screen">
          <Sidebar username={username} onLogout={onLogout} />

          <div className="ds-noise" />

          <main className="relative z-10 flex-1 min-h-screen overflow-hidden">
            <Routes>
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/" element={<Navigate to="/tickets" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
    </ModelProvider>
  )
}

export default function App(props: AppProps) {
  return <AppLayout {...props} />
}
