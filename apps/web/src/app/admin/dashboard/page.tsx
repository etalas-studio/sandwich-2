'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  Crown,
  TrendingUp,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { fetchAdminStats, type AdminStats, type AdminStatsPayment } from '../../../api/admin'

const css = `
  @keyframes animationIn {
    0% { opacity: 0; transform: translateY(16px); filter: blur(6px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
  }
  @keyframes badge-glow {
    0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.15), 0 0 8px rgba(52,211,153,0.3); }
    50%       { box-shadow: 0 0 0 5px rgba(52,211,153,0.08), 0 0 16px rgba(52,211,153,0.5); }
  }
  @keyframes warn-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(251,191,36,0.12), 0 0 8px rgba(251,191,36,0.2); }
    50%       { box-shadow: 0 0 0 5px rgba(251,191,36,0.06), 0 0 14px rgba(251,191,36,0.35); }
  }
  @keyframes bar-grow {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  @keyframes ring-fill {
    from { stroke-dashoffset: 251; }
  }
  .animate-in { animation: animationIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .status-glow { animation: badge-glow 2.4s ease-in-out infinite; }
  .warn-glow { animation: warn-pulse 2.4s ease-in-out infinite; }
  .bar-animated { transform-origin: left; animation: bar-grow 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .ring-animated { animation: ring-fill 0.8s cubic-bezier(0.16,1,0.3,1) both; }
`

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/** Simple stat tile — used for 1-number metrics */
function StatTile({
  label,
  value,
  icon,
  accent = 'text-neutral-400',
  sub,
  delay = 0,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
  sub?: React.ReactNode
  delay?: number
}) {
  return (
    <div
      className="animate-in group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.10] hover:bg-white/[0.06] hover:shadow-xl hover:shadow-black/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`mb-4 w-fit rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 ${accent}`}>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1.5 text-sm text-neutral-500">{label}</div>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  )
}

/** Horizontal bar chart for categorical data */
function HorizontalBarChart({
  rows,
  delay = 0,
}: {
  rows: { label: string; value: number; color: string }[]
  delay?: number
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="space-y-3" style={{ animationDelay: `${delay}ms` }}>
      {rows.map((row, i) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">{row.label}</span>
            <span className="font-medium text-white">{row.value.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full bar-animated ${row.color}`}
              style={{
                width: `${(row.value / max) * 100}%`,
                animationDelay: `${delay + i * 80}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Ring / donut for a single rate (0–100) */
function RingChart({
  pct,
  label,
  sublabel,
  color = 'text-emerald-400',
  strokeColor = '#34d399',
}: {
  pct: number
  label: string
  sublabel: string
  color?: string
  strokeColor?: string
}) {
  const r = 40
  const circ = 2 * Math.PI * r // ≈ 251
  const offset = circ - (pct / 100) * circ
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="ring-animated"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-semibold ${color}`}>{pct}%</span>
        </div>
      </div>
      <div>
        <div className="text-base font-medium text-white">{label}</div>
        <div className="mt-0.5 text-sm text-neutral-500">{sublabel}</div>
      </div>
    </div>
  )
}

/** Vertical bar chart for funnel */
function FunnelBars({
  data,
}: {
  data: { label: string; value: number; color: string; bg: string }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-36 items-end gap-3">
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-medium text-white">{d.value}</span>
          <div className="relative w-full overflow-hidden rounded-t-lg" style={{ height: '80px', background: 'rgba(255,255,255,0.04)' }}>
            <div
              className={`absolute bottom-0 w-full rounded-t-lg bar-animated ${d.bg}`}
              style={{
                height: `${(d.value / max) * 100}%`,
                animationDelay: `${i * 100}ms`,
                transformOrigin: 'bottom',
                animation: `bar-grow 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms both`,
                animationName: 'bar-grow-y',
              }}
            />
          </div>
          <span className="text-[11px] text-neutral-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function statusDot(status: string) {
  if (status === 'settlement') {
    return (
      <span className="flex items-center gap-2">
        <span className="status-glow inline-block h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-emerald-400">{status}</span>
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 opacity-80" />
        <span className="text-yellow-400">{status}</span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full bg-red-400 opacity-80" />
      <span className="text-red-400">{status}</span>
    </span>
  )
}

function PaymentsTable({ payments }: { payments: AdminStatsPayment[] }) {
  if (payments.length === 0) {
    return <p className="text-sm text-neutral-600">No payments yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left">
            {['Order', 'Email', 'Plan', 'Amount', 'Status', 'Fraud', 'Date'].map((h) => (
              <th key={h} className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.orderId} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
              <td className="py-3 pr-6 font-mono text-xs text-neutral-500">{p.orderId.slice(0, 16)}…</td>
              <td className="py-3 pr-6 text-neutral-300">{p.userEmail ?? '—'}</td>
              <td className="py-3 pr-6">
                {p.planSlug ? (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-2.5 py-0.5 text-xs text-neutral-300">{p.planSlug}</span>
                ) : '—'}
              </td>
              <td className="py-3 pr-6 font-medium text-white">{formatRupiah(Number(p.grossAmount))}</td>
              <td className="py-3 pr-6">{statusDot(p.transactionStatus)}</td>
              <td className="py-3 pr-6 text-neutral-500">{p.fraudStatus ?? '—'}</td>
              <td className="py-3 text-neutral-500">{new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setStats(await fetchAdminStats()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load stats') }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-5 py-4 text-sm text-red-300">{error}</div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-3 text-sm text-neutral-600">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-400" />
        Loading…
      </div>
    )
  }

  const funnelTotal = stats.paymentFunnel.initiated + stats.paymentFunnel.settled + stats.paymentFunnel.failed
  const settleRate = funnelTotal > 0 ? Math.round((stats.paymentFunnel.settled / funnelTotal) * 100) : 0
  const proRate = stats.totalUsers > 0 ? Math.round((stats.activeProSubs / stats.totalUsers) * 100) : 0
  const signupDelta = stats.newUsersThisMonth - stats.newUsersLastMonth
  const signupUp = signupDelta >= 0

  return (
    <>
      <style>{css + `
        @keyframes bar-grow-y {
          from { height: 0 !important; }
        }
      `}</style>
      <div className="space-y-12">
        <header className="animate-in" style={{ animationDelay: '0ms' }}>
          <h1 className="text-3xl tracking-wide text-white" style={{ fontFamily: "'Bowlby One', sans-serif" }}>Dashboard</h1>
          <p className="mt-1.5 text-sm text-neutral-500">Overview for this month.</p>
        </header>

        {/* Expiring alert */}
        {stats.expiringSubsCount > 0 && (
          <div className="animate-in warn-glow flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] px-5 py-4 text-sm text-yellow-200" style={{ animationDelay: '40ms' }}>
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
            <span>
              <strong className="font-medium">{stats.expiringSubsCount}</strong> active subscription{stats.expiringSubsCount > 1 ? 's' : ''} expire within 7 days.
            </span>
          </div>
        )}

        {/* ── Row 1: 4 stat tiles ─────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Total users"
              value={stats.totalUsers}
              icon={<Users className="h-4 w-4" />}
              delay={80}
            />
            <StatTile
              label="Active Pro"
              value={stats.activeProSubs}
              icon={<Crown className="h-4 w-4" />}
              accent="text-amber-400"
              delay={140}
            />
            <StatTile
              label="Revenue this month"
              value={formatRupiah(stats.revenueThisMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="text-emerald-400"
              delay={200}
            />
            <StatTile
              label="New signups"
              value={stats.newUsersThisMonth}
              icon={signupUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              accent={signupUp ? 'text-emerald-400' : 'text-red-400'}
              sub={
                <span className={`text-xs ${signupUp ? 'text-emerald-500' : 'text-red-500'}`}>
                  {signupUp ? '+' : ''}{signupDelta} vs last month
                </span>
              }
              delay={260}
            />
          </div>
        </section>

        {/* ── Row 2: Pro conversion ring + usage bars ─────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Conversion &amp; Usage</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Pro conversion ring */}
            <div className="animate-in rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm" style={{ animationDelay: '320ms' }}>
              <div className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-600">Pro conversion</div>
              <RingChart
                pct={proRate}
                label={`${stats.activeProSubs} Pro users`}
                sublabel={`out of ${stats.totalUsers} total`}
                strokeColor="#f59e0b"
                color="text-amber-400"
              />
            </div>

            {/* Usage bars */}
            <div className="animate-in rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm" style={{ animationDelay: '380ms' }}>
              <div className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-600">Usage this month</div>
              <HorizontalBarChart
                rows={[
                  { label: 'Docs', value: stats.usageThisMonth.doc, color: 'bg-blue-400' },
                  { label: 'Prototypes', value: stats.usageThisMonth.prototype, color: 'bg-purple-400' },
                  { label: 'Chat', value: stats.usageThisMonth.chat, color: 'bg-emerald-400' },
                ]}
                delay={400}
              />
            </div>
          </div>
        </section>

        {/* ── Row 3: Payment funnel (vertical bars) + doc breakdown ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Documents &amp; Payments</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Doc type breakdown — horizontal bars */}
            <div className="animate-in rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm" style={{ animationDelay: '440ms' }}>
              <div className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-600">Documents by type (all-time)</div>
              <HorizontalBarChart
                rows={[
                  { label: 'PRD', value: stats.docsByType.prd, color: 'bg-sky-400' },
                  { label: 'Quotation', value: stats.docsByType.quotation, color: 'bg-violet-400' },
                  { label: 'Prototype', value: stats.docsByType.prototype, color: 'bg-pink-400' },
                  { label: 'Specs', value: stats.docsByType.specs, color: 'bg-orange-400' },
                ]}
                delay={460}
              />
            </div>

            {/* Payment funnel + conversion ring */}
            <div className="animate-in rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm" style={{ animationDelay: '500ms' }}>
              <div className="mb-1 text-xs font-medium uppercase tracking-widest text-neutral-600">Payment funnel (this month)</div>
              <div className="mb-4">
                <span className={`text-xs font-medium ${settleRate >= 50 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {settleRate}% settlement rate
                </span>
              </div>
              <FunnelBars
                data={[
                  { label: 'Initiated', value: stats.paymentFunnel.initiated, color: 'text-neutral-300', bg: 'bg-neutral-600' },
                  { label: 'Settled', value: stats.paymentFunnel.settled, color: 'text-emerald-300', bg: 'bg-emerald-600' },
                  { label: 'Failed', value: stats.paymentFunnel.failed, color: 'text-red-300', bg: 'bg-red-700' },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── Recent payments ─────────────────────────────────────── */}
        <section className="animate-in space-y-4" style={{ animationDelay: '560ms' }}>
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Recent payments</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm">
            <PaymentsTable payments={stats.recentPayments} />
          </div>
        </section>
      </div>
    </>
  )
}
