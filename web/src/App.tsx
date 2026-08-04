import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { createTicket as apiCreateTicket, fetchTickets, updateTicket as apiUpdateTicket, deleteTicket as apiDeleteTicket, runTicket, resolveTicket, pullJiraTickets } from './api/tickets'
import { computeStats } from './types'
import { ModelProvider, useModelContext } from './contexts/ModelContext'
import { useIntegrations } from './hooks/useIntegrations'
import ReadinessCard from './components/ReadinessCard'
import { useProjectSettings } from './hooks/useProjectSettings'
import { useScan } from './hooks/useScan'
import { useTicketRun } from './hooks/useTicketRun'

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
        <ReadinessCard
          scan={latestScan!}
          onFix={(rec) => {
            apiCreateTicket({ id: '', summary: rec.title, description: rec.description, url: '' }).then((ticket) => {
              toast.success(`Ticket ${ticket.key} created`)
              return runTicket(ticket.key, selectedModelId ?? undefined)
            }).then(() => toast.success('Pipeline started')).catch((err) => toast.error(err.message))
          }}
        />
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



    </div>
  )
}



function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { selectedModelId } = useModelContext()

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

  const { ticket: liveTicket, isRunning } = useTicketRun(selectedTicket)
  const displayTicket = liveTicket ?? selectedTicket
  const wasRunning = useRef(isRunning)

  // Reload tickets list when a run finishes
  useEffect(() => {
    if (wasRunning.current && !isRunning) {
      void loadTickets()
    }
    wasRunning.current = isRunning
  }, [isRunning])

  const handleOpenTicket = (ticket: Ticket) => {
    setSearchParams({ selected: ticket.key })
  }

  const handleCloseTicket = () => {
    setSearchParams({})
  }

  const { integrations } = useIntegrations()
  const jiraConnected = integrations.some((i) => i.id === 'jira' && i.connected)
  const [isPulling, setIsPulling] = useState(false)

  const handlePull = async () => {
    setIsPulling(true)
    try {
      const result = await pullJiraTickets()
      if (result.ok) {
        toast.success(`Pulled ${result.imported} tickets${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`)
        await loadTickets()
      } else {
        toast.error(result.error ?? 'Pull failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pull failed')
    } finally {
      setIsPulling(false)
    }
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
          <div className="flex items-center gap-2">
          <button
            className="relative inline-flex group"
            onClick={handlePull}
            disabled={isPulling || !jiraConnected}
          >
            <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
            <span
              className="relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6), 0 4px 8px -2px rgba(0,0,0,0.6)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {isPulling ? (
                <iconify-icon icon="solar:refresh-linear" width="14" className="text-white/80 animate-spin" />
              ) : (
                <iconify-icon icon="simple-icons:jira" width="14" className={jiraConnected ? 'text-[#2684FF]' : 'text-white/30'} />
              )}
              {isPulling ? 'Pulling…' : 'Pull Tickets'}
            </span>
          </button>
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
              onDeleteTicket={(ticket) => setDeletingKey(ticket.key)}
              onRunTicket={(ticket) => {
                runTicket(ticket.key, selectedModelId ?? undefined)
                  .then(() => loadTickets())
                  .catch((err) => toast.error(err.message))
              }}
            />
          </>
        )}
      </div>

      {displayTicket && (
        <TicketDetail
          ticket={displayTicket}
          onClose={handleCloseTicket}
          onEdit={displayTicket.status === 'blocked' ? () => { setEditError(null); setEditingTicket(displayTicket) } : undefined}
          onDelete={() => setDeletingKey(displayTicket.key)}
          onResolve={(ticketKey, choiceIndex) => {
            resolveTicket(ticketKey, choiceIndex, selectedModelId ?? undefined)
              .then(() => loadTickets())
              .catch((err) => toast.error(err.message))
          }}
          onRun={(ticket) => {
            runTicket(ticket.key, selectedModelId ?? undefined)
              .then(() => loadTickets())
              .catch((err) => toast.error(err.message))
          }}
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
      <Toaster theme="dark" position="bottom-center" />
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
