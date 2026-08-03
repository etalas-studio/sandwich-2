import type { Ticket, TicketStatus } from '../types'
import TicketCard from './TicketCard'

interface KanbanBoardProps {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
  onRunTicket: (key: string) => void
  onStopTicket: (key: string) => void
  onDuplicateTicket: (key: string) => void
  onDeleteTicket: (key: string) => void
  startingKeys: Set<string>
  stoppingKeys: Set<string>
}

const COLUMNS: { status: TicketStatus; label: string; dotColor: string; glowColor: string }[] = [
  { status: 'backlog', label: 'Backlog', dotColor: 'bg-white/30', glowColor: '' },
  { status: 'in_progress', label: 'In Progress', dotColor: 'bg-[#f59e0b]', glowColor: 'rgba(245,158,11,0.5)' },
  { status: 'blocked', label: 'Blocked', dotColor: 'bg-[#ff8a8a]', glowColor: 'rgba(255,138,138,0.5)' },
  { status: 'done', label: 'Done', dotColor: 'bg-[#8affb1]', glowColor: 'rgba(138,255,177,0.5)' },
]

export default function KanbanBoard({
  tickets,
  onOpenTicket,
  onRunTicket,
  onStopTicket,
  onDuplicateTicket,
  onDeleteTicket,
  startingKeys,
  stoppingKeys,
}: KanbanBoardProps) {
  const ticketsByStatus = new Map<TicketStatus, Ticket[]>(
    COLUMNS.map((col) => [col.status, []])
  )
  for (const ticket of tickets) {
    ticketsByStatus.get(ticket.status)!.push(ticket)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
      {COLUMNS.map((column) => {
        const columnTickets = ticketsByStatus.get(column.status)!
        return (
          <div key={column.status} className="flex flex-col min-w-[280px] w-[280px]">
            {/* Column container with card pattern */}
            <div className="ds-card-outer ds-shadow-elevated flex-1">
              <div className="ds-card-inner flex flex-col h-full">
                {/* Column header */}
                <div className="relative z-10 flex items-center justify-between p-4 pb-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-2 h-2 rounded-full ${column.dotColor}`}
                      style={column.glowColor ? { boxShadow: `0 0 8px ${column.glowColor}` } : undefined}
                    />
                    <span className="text-xs text-white/70 font-normal tracking-wide">
                      {column.label}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 bg-white/[0.05] px-2 py-0.5 rounded-md border border-white/[0.05]">
                    {columnTickets.length}
                  </span>
                </div>

                {/* Column cards */}
                <div className="relative z-10 flex flex-col gap-2 p-3 flex-1 overflow-y-auto hide-scrollbar">
                  {columnTickets.length === 0 ? (
                    <div className="text-xs text-white/30 px-1 py-4 text-center">Empty</div>
                  ) : (
                    columnTickets.map((ticket) => (
                      <TicketCard
                        key={ticket.key}
                        ticket={ticket}
                        onClick={() => onOpenTicket(ticket)}
                        onRun={onRunTicket}
                        onStop={onStopTicket}
                        onDuplicate={onDuplicateTicket}
                        onDelete={onDeleteTicket}
                        isStarting={startingKeys.has(ticket.key)}
                        isStopping={stoppingKeys.has(ticket.key)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
