'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchAdminStats, type AdminStats, type AdminStatsPayment } from '../../../api/admin'

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-neutral-400">{label}</div>
    </div>
  )
}

function statusColor(status: string): string {
  if (status === 'settlement') return 'text-emerald-400'
  if (status === 'pending') return 'text-yellow-400'
  return 'text-red-400'
}

function PaymentsTable({ payments }: { payments: AdminStatsPayment[] }) {
  if (payments.length === 0) {
    return <p className="text-sm text-neutral-500">No payments yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-500">
            <th className="pb-2 pr-4 font-normal">Order</th>
            <th className="pb-2 pr-4 font-normal">Email</th>
            <th className="pb-2 pr-4 font-normal">Plan</th>
            <th className="pb-2 pr-4 font-normal">Amount</th>
            <th className="pb-2 pr-4 font-normal">Status</th>
            <th className="pb-2 pr-4 font-normal">Fraud</th>
            <th className="pb-2 font-normal">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.orderId} className="border-b border-neutral-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-neutral-400">
                {p.orderId.slice(0, 16)}…
              </td>
              <td className="py-2 pr-4">{p.userEmail ?? '—'}</td>
              <td className="py-2 pr-4">{p.planSlug ?? '—'}</td>
              <td className="py-2 pr-4">{formatRupiah(Number(p.grossAmount))}</td>
              <td className={`py-2 pr-4 ${statusColor(p.transactionStatus)}`}>
                {p.transactionStatus}
              </td>
              <td className="py-2 pr-4 text-neutral-400">{p.fraudStatus ?? '—'}</td>
              <td className="py-2 text-neutral-400">
                {new Date(p.createdAt).toLocaleDateString('id-ID')}
              </td>
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
    try {
      setStats(await fetchAdminStats())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!stats) {
    return <div className="text-sm text-neutral-500">Loading…</div>
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">Overview for this month.</p>
      </header>

      {/* Users */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">Users</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Total users" value={stats.totalUsers} />
          <StatTile label="Active Pro" value={stats.activeProSubs} />
          <StatTile label="Starter Users" value={stats.starterUsers} />
        </div>
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">Revenue</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile label="Revenue this month" value={formatRupiah(stats.revenueThisMonth)} />
        </div>
      </section>

      {/* Usage */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Usage this month
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Docs generated" value={stats.usageThisMonth.doc} />
          <StatTile label="Prototypes" value={stats.usageThisMonth.prototype} />
          <StatTile label="Chat messages" value={stats.usageThisMonth.chat} />
        </div>
      </section>

      {/* Recent payments */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Recent payments
        </h2>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <PaymentsTable payments={stats.recentPayments} />
        </div>
      </section>
    </div>
  )
}
