import { useEffect } from 'react'
import { marked } from 'marked'
import { XIcon } from 'lucide-react'
import type { Ticket, QuickWinChoice } from '../api/tickets'
import type { PipelineStage, NeedsHumanCategory } from '../types'

type TicketSource = 'jira' | 'linear' | 'github' | 'internal'

const SOURCE_CONFIG: Record<TicketSource, { icon: string; label: string; color: string }> = {
  jira:    { icon: 'simple-icons:jira',    label: 'Jira',    color: 'text-[#2684FF]' },
  linear:  { icon: 'simple-icons:linear',  label: 'Linear',  color: 'text-[#5E6AD2]' },
  github:  { icon: 'simple-icons:github',  label: 'GitHub',  color: 'text-white/70' },
  internal:{ icon: 'solar:document-linear',label: 'Internal',color: 'text-white/40' },
}

const ISSUE_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  Story:   { icon: 'solar:bookmark-linear',     color: 'text-[#65ba69]' },
  Bug:     { icon: 'solar:bug-linear',           color: 'text-[#e5484d]' },
  Task:    { icon: 'solar:checklist-linear',     color: 'text-[#4d83f8]' },
  Subtask: { icon: 'solar:documents-linear',     color: 'text-[#94a3b8]' },
  Epic:    { icon: 'solar:lightning-linear',     color: 'text-[#b084f4]' },
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'text-[#ff8a8a]',
  High:    'text-[#f59e0b]',
  Medium:  'text-[#94a3b8]',
  Low:     'text-[#6b7280]',
  Lowest:  'text-[#4b5563]',
}

const PRIORITY_ICONS: Record<string, string> = {
  Highest: 'solar:double-alt-arrow-up-linear',
  High:    'solar:alt-arrow-up-linear',
  Medium:  'solar:alt-arrow-right-linear',
  Low:     'solar:alt-arrow-down-linear',
  Lowest:  'solar:double-alt-arrow-down-linear',
}

interface AttachmentMeta {
  filename: string
  mimeType: string
  size: number
  url: string
}

function parseAttachments(raw: string | null): AttachmentMeta[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTicketSource(url: string | null): TicketSource {
  if (!url) return 'internal'
  try {
    const host = new URL(url).host
    if (host.includes('atlassian.net')) return 'jira'
    if (host.includes('linear.app')) return 'linear'
    if (host.includes('github.com')) return 'github'
  } catch { /* fall through */ }
  return 'internal'
}

function MetadataBlock({ ticket }: { ticket: Ticket }) {
  const itCfg = ticket.issueType ? ISSUE_TYPE_CONFIG[ticket.issueType] : null
  const prioColor = ticket.priority ? PRIORITY_COLORS[ticket.priority] : null
  const prioIcon = ticket.priority ? PRIORITY_ICONS[ticket.priority] : null

  return (
    <div className="mb-6">
      <div className="section-label mb-2">Details</div>
      <div className="ds-card-outer" style={{ height: 'auto' }}>
        <div className="ds-card-inner p-3 space-y-2" style={{ height: 'auto' }}>
          {/* Row 0: Jira Status */}
          {ticket.jiraStatus && (
            <div className="flex items-center gap-1.5 pb-1.5 mb-1 border-b border-white/[0.05]">
              <iconify-icon icon="solar:check-circle-linear" width="13" className="text-[#8affb1] shrink-0" />
              <span className="text-[11px] text-white/50 font-light">Status</span>
              <span className="text-xs font-normal text-[#8affb1]">{ticket.jiraStatus}</span>
            </div>
          )}

          {/* Row 1: Type + Priority */}
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {itCfg ? (
                <iconify-icon icon={itCfg.icon} width="13" className={itCfg.color + ' shrink-0'} />
              ) : (
                <iconify-icon icon="solar:bookmark-linear" width="13" className="text-white/20 shrink-0" />
              )}
              <span className="text-[11px] text-white/50 font-light">Type</span>
              <span className={`text-xs font-normal ${ticket.issueType ? 'text-white/70' : 'text-white/20'}`}>{ticket.issueType || '—'}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {prioIcon ? (
                <iconify-icon icon={prioIcon} width="13" className={(prioColor || 'text-white/20') + ' shrink-0'} />
              ) : (
                <iconify-icon icon="solar:alt-arrow-right-linear" width="13" className="text-white/20 shrink-0" />
              )}
              <span className="text-[11px] text-white/50 font-light">Priority</span>
              <span className={`text-xs font-normal ${prioColor || (ticket.priority ? 'text-white/70' : 'text-white/20')}`}>{ticket.priority || '—'}</span>
            </div>
          </div>

          {/* Row 2: Team + Assignee */}
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <iconify-icon icon="solar:users-group-two-rounded-linear" width="13" className="text-white/20 shrink-0" />
              <span className="text-[11px] text-white/50 font-light">Team</span>
              <span className={`text-xs font-normal truncate ${ticket.team ? 'text-white/70' : 'text-white/20'}`}>{ticket.team || '—'}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <iconify-icon icon="solar:user-circle-linear" width="13" className="text-white/20 shrink-0" />
              <span className="text-[11px] text-white/50 font-light">Assignee</span>
              <span className={`text-xs font-normal truncate ${ticket.assignee ? 'text-white/70' : 'text-white/20'}`}>{ticket.assignee || '—'}</span>
            </div>
          </div>

          {/* Row 3: Sprint + Story Points */}
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <iconify-icon icon="solar:clock-circle-linear" width="13" className="text-white/20 shrink-0" />
              <span className="text-[11px] text-white/50 font-light">Sprint</span>
              <span className={`text-xs font-normal truncate ${ticket.sprint ? 'text-white/70' : 'text-white/20'}`}>{ticket.sprint || '—'}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <iconify-icon icon="solar:star-linear" width="13" className="text-white/20 shrink-0" />
              <span className="text-[11px] text-white/50 font-light">Points</span>
              <span className={`text-xs font-mono font-normal ${ticket.storyPoints != null ? 'text-white/70' : 'text-white/20'}`}>{ticket.storyPoints != null ? ticket.storyPoints : '—'}</span>
            </div>
          </div>

          {/* Parent */}
          <div className="flex items-center gap-1.5">
            <iconify-icon icon="solar:link-circle-linear" width="13" className="text-white/20 shrink-0" />
            <span className="text-[11px] text-white/50 font-light">Parent</span>
            <span className={`text-xs font-mono font-normal ${ticket.parentKey ? 'text-white/70' : 'text-white/20'}`}>{ticket.parentKey || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttachmentsSection({ attachments }: { attachments: AttachmentMeta[] }) {
  return (
    <div className="mb-6">
      <div className="section-label mb-2">Attachments ({attachments.length})</div>
      {attachments.length === 0 ? (
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <span className="text-xs text-white/20 font-light">No attachments</span>
        </div>
      ) : (
        <div className="space-y-1">
          {attachments.map((att, i) => (
            <a
              key={i}
              href={att.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors group"
            >
              <iconify-icon icon="solar:paperclip-linear" width="13" className="text-white/30 group-hover:text-white/50 shrink-0 transition-colors" />
              <span className="text-xs text-white/60 font-light truncate flex-1 group-hover:text-white/80 transition-colors">{att.filename}</span>
              <span className="text-[10px] text-white/30 font-mono shrink-0">{formatFileSize(att.size)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

interface TicketDetailProps {
  ticket: Ticket
  onClose: () => void
  onDelete?: () => void
  onRun?: (ticket: Ticket) => void
  onResolve?: (ticketKey: string, choiceIndex: number) => void
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
  quick_win: 'Quick Win',
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
    const currentIndex = STAGE_ORDER.indexOf(ticket.stage as PipelineStage)
    const stageIndex = STAGE_ORDER.indexOf(stage)
    if (stageIndex < currentIndex) return 'done'
    if (stageIndex === currentIndex) return 'blocked'
    return 'pending'
  }
  if (!ticket.stage) return 'pending'
  const currentIndex = STAGE_ORDER.indexOf(ticket.stage as PipelineStage)
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

export default function TicketDetail({ ticket, onClose, onDelete, onRun, onResolve }: TicketDetailProps) {
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg ds-bg border-l border-white/[0.05] z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 pb-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-white/40 font-mono">{ticket.key}</span>
                {ticket.issueType && ISSUE_TYPE_CONFIG[ticket.issueType] && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                    <iconify-icon icon={ISSUE_TYPE_CONFIG[ticket.issueType].icon} width="10" className={ISSUE_TYPE_CONFIG[ticket.issueType].color} />
                    <span className="text-[10px] text-white/30 font-normal">{ticket.issueType}</span>
                  </span>
                )}
                {ticket.priority && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-normal ${PRIORITY_COLORS[ticket.priority] || 'text-white/50'}`}>
                    {PRIORITY_ICONS[ticket.priority] && <iconify-icon icon={PRIORITY_ICONS[ticket.priority]} width="10" />}
                    {ticket.priority}
                  </span>
                )}
                {(() => {
                  const src = getTicketSource(ticket.url)
                  const cfg = SOURCE_CONFIG[src]
                  return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                      <iconify-icon icon={cfg.icon} width="10" className={cfg.color} />
                      <span className="text-[10px] text-white/30 font-normal">{cfg.label}</span>
                    </span>
                  )
                })()}
              </div>
              <h2 className="text-xl font-normal text-white ds-text-shadow">{ticket.summary || ticket.description}</h2>
            </div>
            <button 
              className="text-white/40 hover:text-white transition-colors"
              onClick={onClose}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* URL */}
          {ticket.url && (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/40 hover:text-white/70 hover:underline block mb-4 break-all"
            >
              {ticket.url}
            </a>
          )}

          {/* Metadata */}
          <MetadataBlock ticket={ticket} />

          {/* Attachments */}
          <AttachmentsSection attachments={parseAttachments(ticket.attachments)} />

          {/* Description */}
          <div className="mb-8">
            <div className="section-label">Description</div>
            <div
              className="text-base text-white/80 font-light leading-relaxed ticket-description"
              dangerouslySetInnerHTML={{ __html: marked.parse(ticket.description, { async: false }) as string }}
            />
          </div>

          {/* Pipeline progress */}
          <div className="mb-6">
            <div className="section-label">Pipeline Progress</div>
            <div className="flex flex-col gap-1.5">
              {STAGE_ORDER.map((stage) => {
                const status = getStageStatus(ticket, stage)
                const styles = STAGE_STYLES[status]
                return (
                  <div
                    key={stage}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-light transition-colors ${styles.border} ${styles.bg} ${styles.text}`}
                    style={{ boxShadow: status !== 'pending' ? 'inset 0 1px 1px rgba(255,255,255,0.05)' : undefined }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${status === 'active' ? 'animate-pulse' : ''}`} style={status === 'active' ? { boxShadow: '0 0 8px rgba(245,158,11,0.6)' } : undefined} />
                    <span>{STAGE_LABELS[stage]}</span>
                    {status === 'active' && (
                      <span className="ml-auto text-xs opacity-70 animate-pulse">running</span>
                    )}
                    {status === 'done' && (
                      <span className="ml-auto text-xs opacity-70">✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Blocked reason */}
          {ticket.status === 'blocked' && (ticket.needsHumanReason || ticket.needsHumanCategory) && (
            <div className="ds-card-outer mb-6" style={{ height: 'auto' }}>
              <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]" style={{ height: 'auto' }}>
                <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">
                  {ticket.needsHumanCategory
                    ? `Needs Human — ${NEEDS_HUMAN_LABELS[ticket.needsHumanCategory as NeedsHumanCategory] || ticket.needsHumanCategory}`
                    : 'Needs Human'}
                </h4>
                {ticket.needsHumanReason && (
                  <p className="text-xs text-white/50 font-light">{ticket.needsHumanReason}</p>
                )}

                {/* Quick-win choices */}
                {ticket.quickWinChoices && (() => {
                  let choices: QuickWinChoice[] = [];
                  try { choices = JSON.parse(ticket.quickWinChoices); } catch { /* invalid JSON */ }
                  if (choices.length === 0) return null;
                  return (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {choices.map((choice, i) => (
                        <button
                          key={i}
                          onClick={() => onResolve?.(ticket.key, i)}
                          className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-colors text-left group"
                        >
                          <span className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] text-white/50 font-mono group-hover:text-white/80 transition-colors">{i + 1}</span>
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs text-white/70 font-normal group-hover:text-white transition-colors">{choice.label}</span>
                            <p className="text-[11px] text-white/40 font-light mt-0.5 leading-relaxed">{choice.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Done state */}
          {ticket.status === 'done' && ticket.prUrl && (
            <div className="ds-card-outer mb-6" style={{ height: 'auto' }}>
              <div className="ds-card-inner p-4 border-l-2 border-l-[#8affb1]" style={{ height: 'auto' }}>
                <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">PR Opened</h4>
                {ticket.prSummary && (
                  <p className="text-xs text-white/50 font-light mb-2">{ticket.prSummary}</p>
                )}
                <a
                  href={ticket.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#8affb1] hover:underline break-all"
                >
                  {ticket.prUrl}
                </a>
              </div>
            </div>
          )}

          {/* Backlog state */}
          {ticket.status === 'backlog' && (
            <div className="text-xs text-white/40 mb-6">Not yet started.</div>
          )}
        </div>

        {/* Bottom bar — Run + Delete */}
        <div className="shrink-0 p-4 pt-3 pb-5 border-t border-white/[0.05] bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f] to-[#0a0a0a]">
          <div className="flex gap-2">

            <button
              className="relative inline-flex group flex-1"
              onClick={() => onRun?.(ticket)}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span
                className="relative flex items-center justify-center gap-2 w-full px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                style={{
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                <iconify-icon icon="solar:play-linear" width="14" className="text-white/80" />
                Run
              </span>
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center w-[38px] h-[38px] rounded-lg text-white/50 bg-white/[0.04] border border-white/[0.08] hover:text-[#ff8a8a] hover:border-[#ff8a8a]/30 transition-colors shrink-0"
              >
                <iconify-icon icon="solar:trash-bin-trash-linear" width="16" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
