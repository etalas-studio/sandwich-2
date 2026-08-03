import { useState } from 'react'
import { useTickets, runTicket, computeStats } from './types'
import type { Ticket } from './types'
import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import KanbanBoard from './components/KanbanBoard'
import TicketDetail from './components/TicketDetail'
import Settings from './components/Settings'
import mockData from './mockData'

type NavItem = 'overview' | 'tickets' | 'users' | 'settings'

export default function App() {
  const { tickets, error } = useTickets()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [activeNav, setActiveNav] = useState<NavItem>('overview')
  const [startingKeys, setStartingKeys] = useState<Set<string>>(new Set())
  const [runError, setRunError] = useState<string | null>(null)

  // Use real tickets if available, otherwise fall back to mock data
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

  return (
    <div className="ds-bg min-h-screen text-white antialiased">
      {/* Ambient background blobs */}
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

      {/* Main layout wrapped in card pattern */}
      <div className="ds-card-outer min-h-screen">
        <div className="ds-card-inner flex min-h-screen">
          {/* Sidebar */}
          <Sidebar active={activeNav} onNavigate={handleNavigate} />

          {/* Noise texture overlay */}
          <div className="ds-noise" />

          {/* Main content */}
          <main className="relative z-10 flex-1 min-h-screen overflow-hidden">
            {activeNav === 'settings' ? (
              <Settings onBack={() => setActiveNav('overview')} />
            ) : (
              <div className="h-full overflow-y-auto hide-scrollbar p-6">
                {/* Error banner */}
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

                {/* Header */}
                <div className="mb-8">
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

                {/* Stats */}
                <StatsCards stats={stats} />

                {/* Kanban */}
                <KanbanBoard
                  tickets={displayTickets}
                  onOpenTicket={handleOpenTicket}
                  onRunTicket={handleRunTicket}
                  startingKeys={startingKeys}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Ticket detail overlay */}
      {selectedTicket && (
        <TicketDetail ticket={selectedTicket} onClose={handleCloseTicket} />
      )}
    </div>
  )
}
