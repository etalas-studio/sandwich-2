import { useState } from 'react'
import { useTickets, runTicket, stopTicket, duplicateTicket, deleteTicket, createTicket, computeStats } from './types'
import type { Ticket } from './types'
import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import KanbanBoard from './components/KanbanBoard'
import TicketDetail from './components/TicketDetail'
import Settings from './components/Settings'
import mockData from './mockData'

type NavItem = 'overview' | 'tickets' | 'users' | 'settings'

// Quick Add: a one-click seed of a known real ticket for demoing/testing,
// rather than a full ticket-creation form. createTicket auto-suffixes the
// key if RR-7338 is already taken, so clicking repeatedly just adds more.
const QUICK_ADD_TICKET = {
  key: 'RR-7338',
  url: 'https://runchise.atlassian.net/browse/RR-7338',
  summary: 'Bug: Exported File Name Replaces Mandarin Characters with Underscores (_)',
  description:
    '### Issue\n\nWhen exporting or downloading files, any Mandarin characters included in the file name are replaced with underscores (`_`) instead of being preserved.\n\nThis issue occurs regardless of the system language (Bahasa Indonesia, English, or Mandarin).\n\n**Example**\n\n* **Brand Name:** `Onboard Fajar 库存变动`\n* **Expected File Name:** `Onboard_Fajar_库存变动.xlsx`\n* **Actual File Name:** `Onboard_Fajar_____.xlsx` (Mandarin characters replaced with `_`)\n\n### Expected Behavior\n\n* Preserve all supported Unicode characters (including Mandarin) in exported file names.\n* File names should display correctly across all supported languages without replacing non-Latin characters with underscores.\n* The exported file name should match the original brand name (except for invalid filesystem characters that must still be sanitized).\n\n### Acceptance Criteria\n\n1. Exported file names preserve Mandarin characters.\n2. Exported file names preserve Unicode characters for all supported languages.\n3. Only invalid filename characters (e.g. `\\ / : * ? " < > |`) are sanitized or replaced.\n4. Export works correctly for all export types (e.g. Onboarding, Stock Product, and other exported reports/files).\n5. The issue is resolved regardless of the selected system language (English, Bahasa Indonesia, or Mandarin).',
}

interface AppProps {
  username: string
  onLogout: () => void
}

export default function App({ username, onLogout }: AppProps) {
  const { tickets, error } = useTickets()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [activeNav, setActiveNav] = useState<NavItem>('overview')
  const [startingKeys, setStartingKeys] = useState<Set<string>>(new Set())
  const [stoppingKeys, setStoppingKeys] = useState<Set<string>>(new Set())
  const [runError, setRunError] = useState<string | null>(null)

  const displayTickets = tickets ?? mockData.tickets
  const stats = computeStats(displayTickets)

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
  }

  const handleCloseTicket = () => {
    setSelectedTicket(null)
  }

  const handleNavigate = (item: NavItem) => {
    setActiveNav(item)
    setSelectedTicket(null)
  }

  const handleRunTicket = (key: string) => {
    setStartingKeys((prev) => new Set(prev).add(key))
    setRunError(null)
    runTicket(key)
      .then((result) => {
        if (!result.ok) setRunError(`Could not start ${key}: ${result.message}`)
      })
      .finally(() => {
        setStartingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  const handleStopTicket = (key: string) => {
    setStoppingKeys((prev) => new Set(prev).add(key))
    setRunError(null)
    stopTicket(key)
      .then((result) => {
        if (!result.ok) setRunError(`Could not stop ${key}: ${result.message}`)
      })
      .finally(() => {
        setStoppingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  const handleDuplicateTicket = (key: string) => {
    setRunError(null)
    duplicateTicket(key).then((result) => {
      if (!result.ok) setRunError(`Could not duplicate ${key}: ${result.message}`)
    })
  }

  const handleDeleteTicket = (key: string) => {
    if (!window.confirm(`Delete ${key}? This also removes its run history.`)) return
    setRunError(null)
    deleteTicket(key).then((result) => {
      if (!result.ok) setRunError(`Could not delete ${key}: ${result.message}`)
    })
  }

  const handleQuickAdd = () => {
    setRunError(null)
    createTicket(QUICK_ADD_TICKET).then((result) => {
      if (!result.ok) setRunError(`Could not add ticket: ${result.message}`)
    })
  }

  return (
    <div className="ds-bg min-h-screen text-white antialiased">
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
          <Sidebar active={activeNav} onNavigate={handleNavigate} username={username} onLogout={onLogout} />

          <div className="ds-noise" />

          <main className="relative z-10 flex-1 min-h-screen overflow-hidden">
            {activeNav === 'settings' ? (
              <Settings onBack={() => setActiveNav('overview')} />
            ) : (
              <div className="h-full overflow-y-auto hide-scrollbar p-6">
                {error && (
                  <div className="ds-card-outer mb-6">
                    <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
                      <p className="text-sm text-[#ff8a8a]">Could not connect to server: {error}</p>
                      <p className="text-xs text-white/50 mt-1">Showing mock data instead.</p>
                    </div>
                  </div>
                )}
                {runError && (
                  <div className="ds-card-outer mb-6">
                    <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
                      <p className="text-sm text-[#ff8a8a]">{runError}</p>
                    </div>
                  </div>
                )}

                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
                        Overview
                      </h1>
                      <span className="px-2.5 py-1 rounded-full border border-white/[0.05] bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] text-[10px] text-white/70" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
                        Today
                      </span>
                    </div>
                    <p className="text-sm text-white/50 font-light">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {displayTickets.length} tickets · {displayTickets.filter(t => t.status === 'in_progress').length} active
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="relative inline-flex group shrink-0"
                  >
                    <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                    <span
                      className="relative px-4 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                      style={{
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}
                    >
                      <iconify-icon icon="solar:add-circle-linear" width="14" />
                      Quick Add
                    </span>
                  </button>
                </div>

                <StatsCards stats={stats} />

                <KanbanBoard
                  tickets={displayTickets}
                  onOpenTicket={handleOpenTicket}
                  onRunTicket={handleRunTicket}
                  onStopTicket={handleStopTicket}
                  onDuplicateTicket={handleDuplicateTicket}
                  onDeleteTicket={handleDeleteTicket}
                  startingKeys={startingKeys}
                  stoppingKeys={stoppingKeys}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={handleCloseTicket} />}
    </div>
  )
}
