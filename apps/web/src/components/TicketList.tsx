import type { Ticket } from '../api/tickets'
import type { PipelineStage } from '../types'

interface TicketListProps {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
  onDeleteTicket?: (ticket: Ticket) => void
  onRunTicket?: (ticket: Ticket) => void
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  judge: 'Judge',
  implement: 'Implement',
  verify: 'Verify',
  open_pr: 'Open PR',
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
  onRunTicket,
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
                <th className="text-left px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Stage</th>
                <th className="text-left px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Priority</th>
                <th className="text-right px-4 py-3 text-[10px] text-white/40 font-normal uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-white/30 font-light">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status
                  const statusColor = STATUS_COLORS[ticket.status] ?? { dot: 'bg-white/30', glow: '' }
                  const isInProgress = ticket.status === 'in_progress'
                  const isBacklog = ticket.status === 'backlog'

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

                      {/* Stage */}
                      <td className="px-4 py-3">
                        {ticket.stage ? (
                          <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] text-[10px] font-normal tracking-wide border border-[#5a4525]">
                            {STAGE_LABELS[ticket.stage as PipelineStage] ?? ticket.stage}
                          </span>
                        ) : (
                          <span className="text-xs text-white/20 font-light">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        {ticket.priority ? (
                          <span className="text-xs text-white/50 font-light">{ticket.priority}</span>
                        ) : (
                          <span className="text-xs text-white/20 font-light">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isBacklog && onRunTicket && (
                            <button
                              className="relative inline-flex group"
                              onClick={(e) => {
                                e.stopPropagation()
                                onRunTicket(ticket)
                              }}
                            >
                              <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                              <span
                                className="relative flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                                style={{
                                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                }}
                              >
                                <iconify-icon icon="solar:play-linear" width="10" className="text-white/80" />
                                Run
                              </span>
                            </button>
                          )}
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
