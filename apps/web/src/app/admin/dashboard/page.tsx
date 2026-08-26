'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Users,
  Crown,
  UserCheck,
  TrendingUp,
  FileText,
  Layers,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  UserMinus,
} from 'lucide-react'
import { fetchAdminStats, type AdminStats, type AdminStatsPayment } from '../../../api/admin'

const css = `
  @keyframes animationIn {
    0% { opacity: 0; transform: translateY(16px); filter: blur(6px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
  }
  @keyframes float-card-elements {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  @keyframes badge-glow {
    0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.15), 0 0 8px rgba(52,211,153,0.3); }
    50%       { box-shadow: 0 0 0 5px rgba(52,211,153,0.08), 0 0 16px rgba(52,211,153,0.5); }
  }
  @keyframes warn-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(251,191,36,0.12), 0 0 8px rgba(251,191,36,0.2); }
    50%       { box-shadow: 0 0 0 5px rgba(251,191,36,0.06), 0 0 14px rgba(251,191,36,0.35); }
  }
  .animate-in { animation: animationIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-float { animation: float-card-elements 4s ease-in-out infinite; }
  .status-glow { animation: badge-glow 2.4s ease-in-out infinite; }
  .warn-glow { animation: warn-pulse 2.4s ease-in-out infinite; }
`

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

interface StatTileProps {
  label: string
  value: string | number
  icon: React.ReactNode
  delay?: number
  float?: boolean
  accent?: string
}

function StatTile({ label, value, icon, delay = 0, float = false, accent = 'text-neutral-400' }: StatTileProps) {
  return (
    <div
      className={`animate-in group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.10] hover:bg-white/[0.06] hover:shadow-xl hover:shadow-black/40 ${float ? 'animate-float' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`mb-4 w-fit rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 ${accent}`}>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1.5 text-sm text-neutral-500">{label}</div>
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
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Order</th>
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Email</th>
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Plan</th>
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Amount</th>
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Status</th>
            <th className="pb-3 pr-6 text-xs font-medium uppercase tracking-widest text-neutral-600">Fraud</th>
            <th className="pb-3 text-xs font-medium uppercase tracking-widest text-neutral-600">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr
              key={p.orderId}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <td className="py-3 pr-6 font-mono text-xs text-neutral-500">
                {p.orderId.slice(0, 16)}…
              </td>
              <td className="py-3 pr-6 text-neutral-300">{p.userEmail ?? '—'}</td>
              <td className="py-3 pr-6">
                {p.planSlug ? (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-2.5 py-0.5 text-xs text-neutral-300">
                    {p.planSlug}
                  </span>
                ) : '—'}
              </td>
              <td className="py-3 pr-6 font-medium text-white">{formatRupiah(Number(p.grossAmount))}</td>
              <td className="py-3 pr-6">{statusDot(p.transactionStatus)}</td>
              <td className="py-3 pr-6 text-neutral-500">{p.fraudStatus ?? '—'}</td>
              <td className="py-3 text-neutral-500">
                {new Date(p.createdAt).toLocaleDateString('id-ID')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SignupDelta({ thisMonth, lastMonth }: { thisMonth: number; lastMonth: number }) {
  const delta = thisMonth - lastMonth
  const up = delta >= 0
  return (
    <div className="animate-in flex items-center gap-4" style={{ animationDelay: '280ms' }}>
      <div className={`w-fit rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
      </div>
      <div>
        <div className="text-2xl font-semibold tracking-tight text-white">
          {up ? '+' : ''}{delta}
          <span className="ml-2 text-sm font-normal text-neutral-500">vs last month</span>
        </div>
        <div className="text-sm text-neutral-500">
          {thisMonth} this month · {lastMonth} last month
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setStats(await fetchAdminStats())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-5 py-4 text-sm text-red-300">
        {error}
      </div>
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

  return (
    <>
      <style>{css}</style>
      <div className="space-y-12">
        <header className="animate-in" style={{ animationDelay: '0ms' }}>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1.5 text-sm text-neutral-500">Overview for this month.</p>
        </header>

        {/* Expiring subs alert */}
        {stats.expiringSubsCount > 0 && (
          <div
            className="animate-in warn-glow flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] px-5 py-4 text-sm text-yellow-200"
            style={{ animationDelay: '40ms' }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
            <span>
              <strong className="font-medium">{stats.expiringSubsCount}</strong> active subscription{stats.expiringSubsCount > 1 ? 's' : ''} expire within 7 days.
            </span>
          </div>
        )}

        {/* Users + Revenue bento */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Users &amp; Revenue</h2>
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
              label="Starter users"
              value={stats.starterUsers}
              icon={<UserCheck className="h-4 w-4" />}
              delay={200}
            />
            <StatTile
              label="Revenue this month"
              value={formatRupiah(stats.revenueThisMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="text-emerald-400"
              delay={260}
              float
            />
          </div>
        </section>

        {/* Signup delta */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">New signups</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm">
            <SignupDelta thisMonth={stats.newUsersThisMonth} lastMonth={stats.newUsersLastMonth} />
          </div>
        </section>

        {/* Usage */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Usage this month</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatTile
              label="Docs generated"
              value={stats.usageThisMonth.doc}
              icon={<FileText className="h-4 w-4" />}
              delay={320}
            />
            <StatTile
              label="Prototypes"
              value={stats.usageThisMonth.prototype}
              icon={<Layers className="h-4 w-4" />}
              delay={380}
            />
            <StatTile
              label="Chat messages"
              value={stats.usageThisMonth.chat}
              icon={<MessageSquare className="h-4 w-4" />}
              delay={440}
            />
          </div>
        </section>

        {/* Doc type breakdown */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Documents by type (all-time)</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              { key: 'prd', label: 'PRD' },
              { key: 'quotation', label: 'Quotation' },
              { key: 'prototype', label: 'Prototype' },
              { key: 'specs', label: 'Specs' },
            ] as const).map(({ key, label }, i) => (
              <StatTile
                key={key}
                label={label}
                value={stats.docsByType[key]}
                icon={<FileText className="h-4 w-4" />}
                delay={480 + i * 60}
              />
            ))}
          </div>
        </section>

        {/* Payment funnel */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Payment funnel (this month)</h2>
          <div className="grid grid-cols-3 gap-4">
            <div
              className="animate-in rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm"
              style={{ animationDelay: '700ms' }}
            >
              <div className="mb-4 w-fit rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 text-neutral-400">
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-3xl font-semibold tracking-tight text-white">{stats.paymentFunnel.initiated}</div>
              <div className="mt-1.5 text-sm text-neutral-500">Initiated</div>
            </div>
            <div
              className="animate-in rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 backdrop-blur-sm"
              style={{ animationDelay: '760ms' }}
            >
              <div className="mb-4 w-fit rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-2.5 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="text-3xl font-semibold tracking-tight text-white">{stats.paymentFunnel.settled}</div>
              <div className="mt-1 text-sm text-neutral-500">Settled</div>
              <div className="mt-2 text-xs font-medium text-emerald-500">{settleRate}% conversion</div>
            </div>
            <div
              className="animate-in rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 backdrop-blur-sm"
              style={{ animationDelay: '820ms' }}
            >
              <div className="mb-4 w-fit rounded-xl border border-red-500/20 bg-red-500/[0.08] p-2.5 text-red-400">
                <XCircle className="h-4 w-4" />
              </div>
              <div className="text-3xl font-semibold tracking-tight text-white">{stats.paymentFunnel.failed}</div>
              <div className="mt-1.5 text-sm text-neutral-500">Failed / cancelled</div>
            </div>
          </div>
        </section>

        {/* Recent payments */}
        <section
          className="animate-in space-y-4"
          style={{ animationDelay: '880ms' }}
        >
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-600">Recent payments</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-sm">
            <PaymentsTable payments={stats.recentPayments} />
          </div>
        </section>
      </div>
    </>
  )
}
