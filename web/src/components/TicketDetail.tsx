import { useRunArtifacts } from '../types'
import type { Ticket, PipelineStage, NeedsHumanCategory } from '../types'
import TranscriptView from './TranscriptView'

interface TicketDetailProps {
  ticket: Ticket
  onClose: () => void
}

const STAGE_ORDER: PipelineStage[] = ['judge', 'implement', 'verify', 'open_pr']

const STAGE_LABELS: Record<PipelineStage, string> = {
  judge: 'Judge',
  implement: 'Implement',
  verify: 'Verify',
  open_pr: 'Open PR',
}

const NEEDS_HUMAN_LABELS: Record<NeedsHumanCategory, string> = {
  ambiguous_ticket: 'Ambiguous Ticket',
  forbidden_path: 'Forbidden Path',
  forbidden_path_or_action: 'Forbidden Path/Action',
  weak_verification: 'Weak Verification',
  missing_context: 'Missing Context',
  credential_missing: 'Credential Missing',
  test_failure: 'Test Failure',
  agent_error: 'Agent Error',
}

function getStageStatus(ticket: Ticket, stage: PipelineStage): 'done' | 'active' | 'blocked' | 'pending' {
  if (ticket.status === 'backlog') return 'pending'
  if (ticket.status === 'done') return 'done'
  if (ticket.status === 'blocked') {
    if (!ticket.stage) return 'pending'
    const currentIndex = STAGE_ORDER.indexOf(ticket.stage)
    const stageIndex = STAGE_ORDER.indexOf(stage)
    if (stageIndex < currentIndex) return 'done'
    if (stageIndex === currentIndex) return 'blocked'
    return 'pending'
  }
  // In progress
  if (!ticket.stage) return 'pending'
  const currentIndex = STAGE_ORDER.indexOf(ticket.stage)
  const stageIndex = STAGE_ORDER.indexOf(stage)
  if (stageIndex < currentIndex) return 'done'
  if (stageIndex === currentIndex) return 'active'
  return 'pending'
}

const STAGE_STYLES: Record<'done' | 'active' | 'blocked' | 'pending', { border: string; bg: string; text: string; dot: string }> = {
  done: { border: 'border-[#2b5936]', bg: 'bg-gradient-to-b from-[#1d3a24] to-[#102415]', text: 'text-[#8affb1]', dot: 'bg-[#8affb1]' },
  active: { border: 'border-[#5a4525]', bg: 'bg-gradient-to-b from-[#3a2e1d] to-[#241a10]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  blocked: { border: 'border-[#522525]', bg: 'bg-gradient-to-b from-[#3a1d1d] to-[#241010]', text: 'text-[#ff8a8a]', dot: 'bg-[#ff8a8a]' },
  pending: { border: 'border-white/[0.08]', bg: 'bg-transparent', text: 'text-white/30', dot: 'bg-white/30' },
}

export default function TicketDetail({ ticket, onClose }: TicketDetailProps) {
  const hasRun = ticket.status !== 'backlog'
  const { artifacts } = useRunArtifacts(ticket.key, hasRun)

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md ds-bg border-l border-white/[0.05] z-50 overflow-y-auto hide-scrollbar">
        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs text-white/40 font-mono mb-1">{ticket.key}</div>
              <h2 className="text-xl font-normal text-white ds-text-shadow">{ticket.summary}</h2>
            </div>
            <button 
              className="text-white/40 hover:text-white text-sm transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {/* URL */}
          {ticket.url && (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/40 hover:text-white/70 hover:underline block mb-6"
            >
              {ticket.url}
            </a>
          )}

          {/* Description */}
          <div className="mb-8">
            <div className="section-label">Description</div>
            <p className="text-sm text-white/60 font-light leading-relaxed">{ticket.description}</p>
          </div>

          {/* Pipeline progress */}
          <div className="mb-8">
            <div className="section-label">Pipeline Progress</div>
            <div className="flex flex-col gap-2">
              {STAGE_ORDER.map((stage) => {
                const status = getStageStatus(ticket, stage)
                const styles = STAGE_STYLES[status]
                return (
                  <div
                    key={stage}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-light transition-colors ${styles.border} ${styles.bg} ${styles.text}`}
                    style={{ boxShadow: status !== 'pending' ? 'inset 0 1px 1px rgba(255,255,255,0.05)' : undefined }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                    <span>{STAGE_LABELS[stage]}</span>
                    {status === 'active' && (
                      <>
                        <div className="ml-auto flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                          <span className="text-xs">running</span>
                        </div>
                      </>
                    )}
                    {status === 'blocked' && <span className="ml-auto text-xs">stopped here</span>}
                    {status === 'done' && (
                      <span className="ml-auto text-xs opacity-70">✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Transcript */}
          {hasRun && (
            <div className="mb-8">
              <div className="section-label">Transcript</div>
              <TranscriptView artifacts={artifacts} />
            </div>
          )}

          {/* Blocked reason */}
          {ticket.status === 'blocked' && ticket.needsHumanCategory && ticket.needsHumanReason && (
            <div className="ds-card-outer mb-6">
              <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
                <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">
                  Needs Human — {NEEDS_HUMAN_LABELS[ticket.needsHumanCategory]}
                </h4>
                <p className="text-xs text-white/50 font-light">{ticket.needsHumanReason}</p>
              </div>
            </div>
          )}

          {/* Done state */}
          {ticket.status === 'done' && ticket.prUrl && (
            <div className="ds-card-outer mb-6">
              <div className="ds-card-inner p-4 border-l-2 border-l-[#8affb1]">
                <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">PR Opened</h4>
                {ticket.prSummary && (
                  <p className="text-xs text-white/50 font-light mb-2">{ticket.prSummary}</p>
                )}
                <a
                  href={ticket.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#8affb1] hover:underline"
                >
                  {ticket.prUrl}
                </a>
              </div>
            </div>
          )}

          {/* Backlog state */}
          {ticket.status === 'backlog' && (
            <div className="text-xs text-white/40">Not yet started.</div>
          )}
        </div>
      </div>
    </>
  )
}
