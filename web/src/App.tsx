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
      <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
        <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333] ds-shadow-card shrink-0 mt-0.5">
                <iconify-icon icon="solar:code-linear" width="20" className="text-white/80" />
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
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>TypeScript</span>
                  <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>Node.js 22+</span>
                  <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>React + Vite</span>
                  <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>SQLite</span>
                  <span className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>Pi SDK</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agentic Readiness + Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Agentic Readiness */}
        <div>
          <div className="section-label">Agentic Readiness</div>
          <div className="ds-card-outer ds-shadow-elevated" style={{ height: 'auto' }}>
            <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
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

                <p className="text-sm text-white/50 font-light leading-relaxed mb-5">
                  This project gives AI agents a solid starting point — project context, a phased roadmap,
                  and detailed specs. But there are gaps that would force an agent to guess at architecture
                  and conventions on first encounter.
                </p>

                {/* What's strong */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#8affb1]" style={{ boxShadow: '0 0 6px rgba(138,255,177,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#8affb1] uppercase">What's strong</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <FindingItem
                      icon="solar:document-text-linear"
                      title="CLAUDE.md"
                      detail="Well-structured English project context with working rules, file map, and decision rationale. The single most valuable file for an AI entering this codebase."
                    />
                    <FindingItem
                      icon="solar:map-point-linear"
                      title="Roadmap & specs"
                      detail="docs/roadmap.md tracks every phase with checkboxes; 6 design specs and 5 implementation plans give agents detailed guidance for any task."
                    />
                    <FindingItem
                      icon="solar:code-linear"
                      title="Well-defined tooling"
                      detail="package.json has clear build, test, typecheck, and serve scripts. An agent can verify its work without guessing the right commands."
                    />
                    <FindingItem
                      icon="solar:history-linear"
                      title="CHANGELOG.md"
                      detail="Task-level change log lets an agent understand what was recently built and why — useful context before touching adjacent code."
                    />
                  </div>
                </div>

                {/* Needs attention */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#f59e0b]" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#f59e0b] uppercase">Needs attention</span>
                  </div>
                  <FindingItem
                    icon="solar:translation-linear"
                    title="README.md is in Indonesian"
                    detail="Most AI coding models perform best with English project context. The README is thorough but an English version (or a short English summary at the top) would significantly improve first-read comprehension for English-language agents."
                  />
                </div>

                {/* Missing */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#ff8a8a]" style={{ boxShadow: '0 0 6px rgba(255,138,138,0.4)' }} />
                    <span className="text-xs font-normal tracking-wide text-[#ff8a8a] uppercase">Missing</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <FindingItem
                      icon="solar:structure-linear"
                      title="architecture.md"
                      detail="No document describing pipeline stages, data flow, or how subsystems connect. Agents must infer structure from source."
                    />
                    <FindingItem
                      icon="solar:mention-circle-linear"
                      title="AGENTS.md"
                      detail="No project-specific AI instructions. Conventions like no-shell-in-proc.ts and append-only records are only in CLAUDE.md's working rules."
                    />
                    <FindingItem
                      icon="solar:users-group-rounded-linear"
                      title="CONTRIBUTING.md"
                      detail="No contributor guide. Agents and humans alike have no documented workflow for branching, commits, or review expectations."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <div className="section-label">Recommendations</div>
          <div className="ds-card-outer ds-shadow-elevated" style={{ height: 'auto' }}>
            <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
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
        </div>
      </div>

      {/* ── Area Signals ── */}
      <div className="section-label">Area Signals</div>
      <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: 'auto' }}>
        <div className="ds-card-inner overflow-hidden" style={{ height: 'auto' }}>
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/[0.04] bg-[#0a0a0a]/50">
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Area</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Files</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Test Coverage</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Churn</th>
                  <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                <AreaRow
                  area="src/pipeline"
                  files={2}
                  coverage={50}
                  churn={66}
                  note="Core orchestration. Light on tests relative to churn — actively being built."
                />
                <AreaRow
                  area="src/db"
                  files={9}
                  coverage={56}
                  churn={63}
                  note="Storage layer. Migrations and migrate.ts untested; repos are well-covered."
                />
                <AreaRow
                  area="src/engine"
                  files={7}
                  coverage={57}
                  churn={20}
                  note="Agent invocation. Manual-check files and proc.ts lack direct tests."
                />
                <AreaRow
                  area="src/auth"
                  files={4}
                  coverage={75}
                  churn={15}
                  note="Session auth with CSRF. Only middleware.ts lacks a direct test."
                />
                <AreaRow
                  area="src/web-server.ts"
                  files={1}
                  coverage={100}
                  churn={3}
                  note="HTTP server entry point. Single file, fully tested."
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Finding item (used in Agentic Readiness) ── */

function FindingItem({
  icon,
  title,
  detail,
}: {
  icon: string
  title: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
      <iconify-icon icon={icon} width="14" className="text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-xs text-white/70 font-normal">{title}</span>
        <p className="text-[11px] text-white/35 font-light mt-0.5 leading-relaxed">{detail}</p>
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

/* ── Area signal table row ── */

function AreaRow({
  area,
  files,
  coverage,
  churn,
  note,
}: {
  area: string
  files: number
  coverage: number
  churn: number
  note: string
}) {
  const coverageColor = coverage >= 70 ? 'text-[#8affb1]' : coverage >= 40 ? 'text-[#f59e0b]' : 'text-[#ff8a8a]'
  const coverageBg = coverage >= 70 ? 'bg-[#8affb1]' : coverage >= 40 ? 'bg-[#f59e0b]' : 'bg-[#ff8a8a]'

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-6 py-3.5 text-white/80 font-mono text-xs">{area}</td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs">{files}</td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 max-w-20 h-1 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }}>
            <div className={`h-full rounded-full ${coverageBg}`} style={{ width: `${coverage}%`, boxShadow: coverage >= 70 ? '0 0 6px rgba(138,255,177,0.3)' : coverage >= 40 ? '0 0 6px rgba(245,158,11,0.3)' : '0 0 6px rgba(255,138,138,0.3)' }} />
          </div>
          <span className={`text-xs font-mono font-light ${coverageColor}`}>{coverage}%</span>
        </div>
      </td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs font-mono">{churn}</td>
      <td className="px-6 py-3.5 text-white/40 font-light text-xs max-w-64 leading-relaxed">{note}</td>
    </tr>
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
