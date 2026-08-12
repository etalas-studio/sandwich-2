import type { Ticket } from '../api/tickets'

interface TicketListProps {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
  onDeleteTicket?: (ticket: Ticket) => void
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

const STATUS_COLORS: Record<string, { dot: string; glow: string }> = {
  backlog: { dot: 'bg-white/30', glow: '' },
  in_progress: { dot: 'bg-[#f59e0b]', glow: 'rgba(245,158,11,0.5)' },
  blocked: { dot: 'bg-[#ff8a8a]', glow: 'rgba(255,138,138,0.5)' },
  done: { dot: 'bg-[#8affb1]', glow: 'rgba(138,255,177,0.5)' },
}

export default function TicketList({
  tickets,
  onOpenTicket,
  onDeleteTicket,
}: TicketListProps) {
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <div className="ds-card-outer ds-shadow-elevated">
        <div className="ds-card-inner overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Key</th>
                <th className="text-left px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Summary</th>
                <th className="text-left px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-xs text-white/30 font-light">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status
                  const statusColor = STATUS_COLORS[ticket.status] ?? { dot: 'bg-white/30', glow: '' }
                  const isInProgress = ticket.status === 'in_progress'

                  return (
                    <tr
                      key={ticket.key}
                      onClick={() => onOpenTicket(ticket)}
                      className="border-b border-white/[0.02] hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      {/* Key */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-white/40 font-mono">{ticket.key}</span>
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/80 font-light line-clamp-1">
                          {ticket.summary || ticket.description}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} ${isInProgress ? 'animate-pulse' : ''}`}
                            style={statusColor.glow && isInProgress ? { boxShadow: `0 0 6px ${statusColor.glow}` } : undefined}
                          />
                          <span className="text-xs text-white/60 font-light">{statusLabel}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onDeleteTicket && (
                            <button
                              className="flex items-center justify-center w-6 h-6 rounded text-white/30 hover:text-[#ff8a8a] hover:bg-white/[0.06] transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteTicket(ticket)
                              }}
                              aria-label="Delete"
                            >
                              <iconify-icon icon="solar:trash-bin-trash-linear" width="13" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
