import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import { computeStats } from './types'
import type { Ticket } from './types'
import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import KanbanBoard from './components/KanbanBoard'
import TicketDetail from './components/TicketDetail'
import Settings from './components/Settings'
import Integrations from './components/Integrations'
import mockData from './mockData'

function OverviewPage() {
  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-6">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
            Overview
          </h1>
        </div>
        <p className="text-sm text-white/50 font-light">
          How AI-ready this project is, at a glance.
        </p>
      </div>

      {/* ── Project Description ── */}
      <div className="section-label">Project</div>
      <div className="ds-card-outer ds-shadow-elevated mb-8">
        <div className="ds-card-inner p-6">
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333] ds-shadow-card shrink-0 mt-0.5">
                <iconify-icon icon="solar:widget-5-linear" width="20" className="text-white/80" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-normal tracking-tight text-white ds-text-shadow mb-2">
                  Runchise Agent Pipeline
                </h2>
                <p className="text-sm text-white/60 font-light leading-relaxed">
                  An orchestrator that runs AI coding agents per ticket in isolated git worktrees.
                  Each attempt goes through a{' '}
                  <span className="italic font-light text-white/80" style={{ fontFamily: "'Playfair Display', serif" }}>Judge → Implement → Verify</span>
                  {' '}pipeline with guardrails that block risky changes before a single line of code is touched.
                  Built to produce evidence — not impressions — for the Runchise pilot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agentic Readiness ── */}
      <div className="section-label">Agentic Readiness</div>
      <div className="ds-card-outer ds-shadow-elevated mb-8">
        <div className="ds-card-inner p-6">
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10">
            {/* Readiness summary bar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] text-[10px] font-normal tracking-wide border border-[#5a4525]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
                  Good
                </span>
                <span className="text-xs text-white/40 font-light">6 of 10 signals present</span>
              </div>
              <div className="flex-1 h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }}>
                <div className="h-full bg-gradient-to-r from-[#f59e0b]/60 to-[#f59e0b] rounded-full w-[60%]" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.3)' }} />
              </div>
            </div>

            {/* Context files grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <ReadinessItem
                icon="solar:document-text-linear"
                label="CLAUDE.md"
                status="present"
                detail="English, good project orientation"
              />
              <ReadinessItem
                icon="solar:document-text-linear"
                label="README.md"
                status="partial"
                detail="Indonesian — AI models work better with English"
              />
              <ReadinessItem
                icon="solar:map-point-linear"
                label="Roadmap"
                status="present"
                detail="Clear phase tracking with checkboxes"
              />
              <ReadinessItem
                icon="solar:documents-linear"
                label="Spec docs"
                status="present"
                detail="6 specs in docs/superpowers/specs/"
              />
              <ReadinessItem
                icon="solar:checklist-linear"
                label="Implementation plans"
                status="present"
                detail="5 plans in docs/superpowers/plans/"
              />
              <ReadinessItem
                icon="solar:code-linear"
                label="package.json scripts"
                status="present"
                detail="build, test, serve, typecheck defined"
              />
              <ReadinessItem
                icon="solar:history-linear"
                label="CHANGELOG.md"
                status="present"
                detail="One entry per completed task"
              />
              <ReadinessItem
                icon="solar:document-text-linear"
                label="AGENTS.md"
                status="missing"
                detail="No agent-specific instructions file"
              />
              <ReadinessItem
                icon="solar:structure-linear"
                label="architecture.md"
                status="missing"
                detail="No dedicated architecture document"
              />
              <ReadinessItem
                icon="solar:users-group-rounded-linear"
                label="CONTRIBUTING.md"
                status="missing"
                detail="No contributor guide"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="section-label">Recommendations</div>
      <div className="ds-card-outer ds-shadow-elevated mb-8">
        <div className="ds-card-inner p-6">
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-1">
            <RecommendationItem
              icon="solar:translation-linear"
              title="Translate README.md to English"
              description="AI coding agents parse English project context more reliably. An English README alongside the existing Indonesian one (or replacing it) would improve first-read comprehension for any agent entering this codebase."
            />
            <RecommendationItem
              icon="solar:structure-linear"
              title="Add an architecture.md"
              description="Document the pipeline stages, data flow between orchestrator and worktrees, and how guardrails, credential storage, and the web server fit together. This gives agents a structural map before they start reading source files."
            />
            <RecommendationItem
              icon="solar:mention-circle-linear"
              title="Add AGENTS.md with project-specific rules"
              description="An AGENTS.md (or .cursorrules) file tells AI agents about conventions unique to this project: no shell in proc.ts, append-only run records, the credential store pattern, and the working rules from CLAUDE.md that agents should follow."
            />
            <RecommendationItem
              icon="solar:users-group-rounded-linear"
              title="Add CONTRIBUTING.md"
              description="Helps both human contributors and AI agents understand the contribution workflow: branch naming, commit conventions, how to run tests, and what the review process expects."
            />
          </div>
        </div>
      </div>

      {/* ── Technical Information ── */}
      <div className="section-label">Technical Information</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Stack */}
        <div className="ds-card-outer ds-shadow-elevated">
          <div className="ds-card-inner p-6">
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-sm font-normal tracking-tight text-white ds-text-shadow mb-4 flex items-center gap-2">
                <iconify-icon icon="solar:layers-linear" width="16" className="text-white/50" />
                Stack
              </h3>
              <div className="space-y-3">
                <TechRow label="Runtime" value="Node.js 22+" />
                <TechRow label="Language" value="TypeScript 5.6" />
                <TechRow label="Frontend" value="React 18 + Vite + Tailwind CSS" />
                <TechRow label="Storage" value="better-sqlite3 (embedded)" />
                <TechRow label="Agent Engine" value="Pi SDK (@earendil-works/pi-coding-agent)" />
                <TechRow label="Terminal" value="node-pty (PTY-mode invocation)" />
                <TechRow label="Testing" value="Node.js native test runner" />
                <TechRow label="Package manager" value="npm" />
              </div>
            </div>
          </div>
        </div>

        {/* Architecture */}
        <div className="ds-card-outer ds-shadow-elevated">
          <div className="ds-card-inner p-6">
            <div className="absolute inset-0 ds-noise pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-sm font-normal tracking-tight text-white ds-text-shadow mb-4 flex items-center gap-2">
                <iconify-icon icon="solar:graph-new-linear" width="16" className="text-white/50" />
                Architecture
              </h3>
              <div className="space-y-3">
                <TechRow label="Pipeline" value="Judge → Implement → Verify → Open PR (phase-gated)" />
                <TechRow label="Isolation" value="One git worktree per ticket attempt" />
                <TechRow label="Guardrails" value="File/bound allowlists, diff limits, domain blocklists enforced by orchestrator" />
                <TechRow label="Records" value="Append-only JSONL + per-run folders (plan, diff, transcript, test results)" />
                <TechRow label="Auth" value="Custom single-account session auth with CSRF protection" />
                <TechRow label="Server" value="node:http (zero runtime deps beyond sqlite3 and pi SDK)" />
                <TechRow label="Deployment" value="Server-agnostic — runs anywhere Node runs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Readiness checklist item ── */

function ReadinessItem({
  icon,
  label,
  status,
  detail,
}: {
  icon: string
  label: string
  status: 'present' | 'partial' | 'missing'
  detail: string
}) {
  const colors = {
    present: { bg: 'bg-[#1d3a24]', border: 'border-[#2b5936]', text: 'text-[#8affb1]', dot: 'bg-[#8affb1]' },
    partial: { bg: 'bg-[#3a2e1d]', border: 'border-[#5a4525]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
    missing: { bg: 'bg-white/[0.03]', border: 'border-white/[0.05]', text: 'text-white/30', dot: 'bg-white/20' },
  }[status]

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${colors.bg} border ${colors.border} transition-colors`} style={{ boxShadow: status !== 'missing' ? 'inset 0 1px 1px rgba(255,255,255,0.05)' : undefined }}>
      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0 mt-1.5`} style={status === 'present' ? { boxShadow: '0 0 6px rgba(138,255,177,0.4)' } : status === 'partial' ? { boxShadow: '0 0 6px rgba(245,158,11,0.4)' } : undefined} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <iconify-icon icon={icon} width="13" className={colors.text} />
          <span className={`text-xs font-normal tracking-wide ${colors.text}`}>{label}</span>
        </div>
        <p className="text-[10px] text-white/30 font-light mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </div>
  )
}

/* ── Recommendation list item ── */

function RecommendationItem({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
      <iconify-icon icon={icon} width="16" className="text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-sm text-white/80 font-light">{title}</span>
        <p className="text-xs text-white/40 font-light mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

/* ── Tech info key-value row ── */

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-white/35 font-light shrink-0 w-28">{label}</span>
      <span className="text-xs text-white/70 font-light">{value}</span>
    </div>
  )
}

function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const displayTickets = mockData.tickets
  const selectedKey = searchParams.get('selected')
  const selectedTicket = selectedKey
    ? displayTickets.find(t => t.key === selectedKey) ?? null
    : null
  const stats = computeStats(displayTickets)

  const handleOpenTicket = (ticket: Ticket) => {
    setSearchParams({ selected: ticket.key })
  }

  const handleCloseTicket = () => {
    setSearchParams({})
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
              {displayTickets.length} tickets
            </p>
          </div>
        </div>

        <StatsCards stats={stats} />

        <KanbanBoard
          tickets={displayTickets}
          onOpenTicket={handleOpenTicket}
        />
      </div>

      {selectedTicket && (
        <TicketDetail ticket={selectedTicket} onClose={handleCloseTicket} />
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
    <div className="ds-bg min-h-screen text-white antialiased">
      <Toaster theme="dark" position="top-right" />
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
  )
}

export default function App(props: AppProps) {
  return <AppLayout {...props} />
}
