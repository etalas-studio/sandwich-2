'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminUsers,
  setUserRole,
  manageUserSubscription,
  type AdminUser,
  type AdminUsersResponse,
} from '../../../api/admin'

function Badge({
  text,
  color,
}: {
  text: string
  color: 'green' | 'blue' | 'yellow' | 'neutral'
}) {
  const cls = {
    green: 'bg-emerald-950 text-emerald-300',
    blue: 'bg-blue-950 text-blue-300',
    yellow: 'bg-yellow-950 text-yellow-300',
    neutral: 'bg-neutral-800 text-neutral-400',
  }[color]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{text}</span>
  )
}

function planColor(planSlug: string | undefined): 'green' | 'blue' | 'neutral' {
  if (planSlug === 'pro') return 'green'
  if (planSlug === 'starter') return 'blue'
  return 'neutral'
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID')
}

export default function UsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ kind: 'error' | 'notice'; text: string } | null>(
    null,
  )
  const LIMIT = 50

  const load = useCallback(async (p: number) => {
    try {
      setError(null)
      setData(await fetchAdminUsers(p, LIMIT))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => { void load(page) }, [load, page])

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true)
    setActionMsg(null)
    try {
      await fn()
      setActionMsg({ kind: 'notice', text: okMsg })
      await load(page)
    } catch (err) {
      setActionMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Action failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleRole = (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    if (
      newRole === 'admin' &&
      !window.confirm(`Promote ${user.email} to admin?`)
    )
      return
    void run(() => setUserRole(user.id, newRole), `Role updated to ${newRole}`)
  }

  const cancelSub = (user: AdminUser) => {
    if (!window.confirm(`Cancel subscription for ${user.email}?`)) return
    void run(
      () => manageUserSubscription(user.id, 'cancel'),
      'Subscription cancelled',
    )
  }

  const grantPlan = (user: AdminUser, planSlug: 'starter' | 'pro') => {
    void run(
      () => manageUserSubscription(user.id, 'grant', planSlug),
      `Granted ${planSlug}`,
    )
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  if (error) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        {data && (
          <p className="mt-1 text-sm text-neutral-500">{data.total} total</p>
        )}
      </header>

      {actionMsg && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
            actionMsg.kind === 'error'
              ? 'border-red-900 bg-red-950/40 text-red-300'
              : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded px-1 text-neutral-400 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>
      )}

      {!data ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-500">
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Role</th>
                  <th className="px-4 py-3 font-normal">Plan</th>
                  <th className="px-4 py-3 font-normal">Expires</th>
                  <th className="px-4 py-3 font-normal">Doc</th>
                  <th className="px-4 py-3 font-normal">Proto</th>
                  <th className="px-4 py-3 font-normal">Chat</th>
                  <th className="px-4 py-3 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-800/50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>{user.email}</div>
                      <div className="text-xs text-neutral-500">{user.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        text={user.role}
                        color={user.role === 'admin' ? 'yellow' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {user.subscription ? (
                        <Badge
                          text={user.subscription.planSlug}
                          color={planColor(user.subscription.planSlug)}
                        />
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatExpiry(user.subscription?.expiresAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {user.usageThisMonth.doc}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {user.usageThisMonth.prototype}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {user.usageThisMonth.chat}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => toggleRole(user)}
                          disabled={busy}
                          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {user.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => grantPlan(user, 'pro')}
                          disabled={busy}
                          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Grant Pro
                        </button>
                        <button
                          onClick={() => grantPlan(user, 'starter')}
                          disabled={busy}
                          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Grant Starter
                        </button>
                        {user.subscription?.status === 'active' && (
                          <button
                            onClick={() => cancelSub(user)}
                            disabled={busy}
                            className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                          >
                            Cancel sub
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-neutral-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
