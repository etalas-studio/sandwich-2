import type { Ticket } from '../api/tickets'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface TicketCardProps {
  ticket: Ticket
  onClick: () => void
  onDelete?: (ticket: Ticket) => void
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TicketCard({
  ticket,
  onClick,
  onDelete,
}: TicketCardProps) {
  const isInProgress = ticket.status === 'in_progress'
  const isBlocked = ticket.status === 'blocked'
  const isDone = ticket.status === 'done'

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg border cursor-pointer transition-colors
        ${isInProgress ? 'border-[#f59e0b]/30 hover:border-[#f59e0b]/50' : ''}
        ${isBlocked ? 'border-[#ff8a8a]/20 hover:border-[#ff8a8a]/40' : ''}
        ${isDone ? 'border-white/[0.03] hover:border-white/[0.06] opacity-80' : 'border-white/[0.05] hover:border-white/[0.08]'}
      `}
    >
      {/* Top accent line for active/blocked */}
      {isInProgress && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#f59e0b] to-transparent rounded-t-lg" />
      )}
      {isBlocked && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ff8a8a] to-transparent rounded-t-lg" />
      )}

      {/* Card content */}
      <div className="p-3 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isInProgress && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse shrink-0" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.6)' }} />
            )}
            <span className="text-[10px] text-white/30 font-mono">{ticket.key}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center justify-center w-5 h-5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <iconify-icon icon="solar:menu-dots-bold" width="12" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-28 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border border-white/[0.08]"
              style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05), 0 12px 24px -6px rgba(0,0,0,0.8)' }}
            >
              <DropdownMenuItem
                className="text-xs text-white/60 hover:text-white hover:bg-white/[0.06] focus:!bg-white/[0.06] focus:!text-white cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(ticket)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>

        {/* Summary */}
        <h4 className="text-sm text-white font-light mb-2 tracking-tight ds-text-shadow line-clamp-2">
          {ticket.summary || ticket.description}
        </h4>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
          <span className="text-[10px] text-white/30 font-light">
            {isInProgress ? `Started ${formatRelativeTime(ticket.startedAt)}` : 
             isDone ? `Finished ${formatRelativeTime(ticket.finishedAt)}` :
             ticket.startedAt ? `Ran ${formatRelativeTime(ticket.startedAt)}` : ''}
          </span>
          <div className="flex items-center gap-1.5">

          </div>
        </div>
      </div>
    </div>
  )
}
