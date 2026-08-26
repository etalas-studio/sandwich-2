'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAdminUsers,
  manageUserSubscription,
  type AdminUser,
  type AdminUsersResponse,
} from '../../../api/admin'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
} from '../../../components/ui/select'
import { ChevronDown } from 'lucide-react'

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
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{text}</span>
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
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | 'admin' | 'user'>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ kind: 'error' | 'notice'; text: string } | null>(null)
  // confirm modal state
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null)
  const LIMIT = 50
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (p: number, q: string, r: string) => {
    try {
      setError(null)
      setData(await fetchAdminUsers(p, LIMIT, q || undefined, r || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => { void load(page, search, roleFilter) }, [load, page, search, roleFilter])

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load(1, val, roleFilter), 350)
  }

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true)
    setActionMsg(null)
    try {
      await fn()
      setActionMsg({ kind: 'notice', text: okMsg })
      await load(page, search, roleFilter)
    } catch (err) {
      setActionMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    } finally {
      setBusy(false)
    }
  }

  const grantPlan = (user: AdminUser, planSlug: 'starter' | 'pro') => {
    void run(
      () => manageUserSubscription(user.id, 'grant', planSlug),
      `Granted ${planSlug} to ${user.email}`,
    )
  }

  const cancelSub = (user: AdminUser) => {
    void run(
      () => manageUserSubscription(user.id, 'cancel'),
      `Subscription cancelled for ${user.email}`,
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
        {data && <p className="mt-1 text-sm text-neutral-500">{data.total} total</p>}
      </header>

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search email or username…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-500"
        />
        <Select<'' | 'admin' | 'user'> value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
          <SelectTrigger className="h-9 gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300 outline-none focus:border-neutral-500">
            <SelectValue placeholder="All roles" />
            <SelectIcon><ChevronDown className="h-3.5 w-3.5 text-neutral-500" /></SelectIcon>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                  <th className="px-4 py-3 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-neutral-200">{user.email}</div>
                      <div className="text-xs text-neutral-500">{user.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge text={user.role} color={user.role === 'admin' ? 'yellow' : 'neutral'} />
                    </td>
                    <td className="px-4 py-3">
                      {user.subscription ? (
                        <Badge
                          text={user.subscription.planSlug}
                          color={planColor(user.subscription.planSlug)}
                        />
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatExpiry(user.subscription?.expiresAt ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {/* Grant plan dropdown */}
                        <Select<'pro' | 'starter'>
                          onValueChange={(v) => grantPlan(user, v)}
                        >
                          <SelectTrigger
                            disabled={busy}
                            className="h-7 gap-1.5 rounded border border-neutral-700 bg-transparent px-2.5 text-xs text-neutral-400 outline-none hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
                          >
                            <SelectValue placeholder="Grant plan" />
                            <SelectIcon><ChevronDown className="h-3 w-3 text-neutral-500" /></SelectIcon>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Cancel sub — only when active */}
                        {user.subscription?.status === 'active' && (
                          <button
                            onClick={() => setConfirmTarget(user)}
                            disabled={busy}
                            className="h-7 rounded border border-red-900/60 px-2.5 text-xs text-red-400 transition-colors hover:bg-red-950/40 hover:border-red-800 disabled:opacity-50"
                          >
                            Cancel sub
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-600">
                      No users found.
                    </td>
                  </tr>
                )}
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
              <span className="text-neutral-400">{page} / {totalPages}</span>
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

      {/* Cancel confirmation modal */}
      <Dialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}>
        <DialogContent showCloseButton={false} className="max-w-sm bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>Cancel subscription</DialogTitle>
            <DialogDescription>
              This will immediately deactivate the subscription for{' '}
              <span className="font-medium text-neutral-200">{confirmTarget?.email}</span>.
              The user loses access to Pro features right away.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmTarget(null)}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
            >
              Keep subscription
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (confirmTarget) {
                  cancelSub(confirmTarget)
                  setConfirmTarget(null)
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Yes, cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
