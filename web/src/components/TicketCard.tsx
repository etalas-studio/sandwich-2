import type { Ticket, PipelineStage } from '../types'

interface TicketCardProps {
  ticket: Ticket
  onClick: () => void
  onRun: (key: string) => void
  isStarting: boolean
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  judge: 'Judge',
  implement: 'Implement',
  verify: 'Verify',
  open_pr: 'Open PR',
}

const NEEDS_HUMAN_LABELS: Record<string, string> = {
  ambiguous_ticket: 'Ambiguous ticket',
  forbidden_path: 'Forbidden path',
  forbidden_path_or_action: 'Forbidden path',
  weak_verification: 'Weak verification',
  missing_context: 'Missing context',
  credential_missing: 'Credential missing',
  test_failure: 'Test failure',
  agent_error: 'Agent error',
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

export default function TicketCard({ ticket, onClick, onRun, isStarting }: TicketCardProps) {
  const isInProgress = ticket.status === 'in_progress'
  const isBlocked = ticket.status === 'blocked'
  const isDone = ticket.status === 'done'
  const isBacklog = ticket.status === 'backlog'

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
          <span className="text-[10px] text-white/30 font-mono">{ticket.key}</span>
          {isInProgress && ticket.stage && (
            <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] text-[10px] font-normal tracking-wide border border-[#5a4525]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
              {STAGE_LABELS[ticket.stage]}
            </span>
          )}
          {isBlocked && ticket.needsHumanCategory && (
            <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a1d1d] to-[#241010] text-[#ff8a8a] text-[10px] font-normal tracking-wide border border-[#522525]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
              {NEEDS_HUMAN_LABELS[ticket.needsHumanCategory] || ticket.needsHumanCategory}
            </span>
          )}
          {isDone && ticket.prUrl && (
            <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#1d3a24] to-[#102415] text-[#8affb1] text-[10px] font-normal tracking-wide border border-[#2b5936]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
              PR
            </span>
          )}
        </div>

        {/* Summary */}
        <h4 className="text-sm text-white font-light mb-2 tracking-tight ds-text-shadow line-clamp-2">
          {ticket.summary}
        </h4>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
          <span className="text-[10px] text-white/30 font-light">
            {isInProgress ? `Started ${formatRelativeTime(ticket.startedAt)}` : 
             isDone ? `Finished ${formatRelativeTime(ticket.finishedAt)}` :
             ticket.startedAt ? `Ran ${formatRelativeTime(ticket.startedAt)}` : ''}
          </span>
          {isInProgress && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
              <span className="text-[10px] text-[#f59e0b] font-light">Running</span>
            </div>
          )}
          {isDone && ticket.prUrl && (
            <a
              href={ticket.prUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#8affb1] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View →
            </a>
          )}
          {isBacklog && (
            <button
              type="button"
              disabled={isStarting}
              onClick={(e) => {
                e.stopPropagation()
                onRun(ticket.key)
              }}
              className="px-2 py-0.5 rounded bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] text-white/70 text-[10px] font-normal tracking-wide border border-white/[0.08] hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}
            >
              {isStarting ? 'Starting…' : 'Run'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
