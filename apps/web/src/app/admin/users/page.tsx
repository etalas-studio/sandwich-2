'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, ChevronDown } from 'lucide-react'
import {
  fetchAdminUsers,
  manageUserSubscription,
  deleteAdminUser,
  setUserRole,
  type AdminUser,
  type AdminUsersResponse,
} from '../../../api/admin'
import {
  Dialog,
  DialogClose,
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

const css = `
  @keyframes animationIn {
    0% { opacity: 0; transform: translateY(16px); filter: blur(6px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0px); }
  }
  .animate-in { animation: animationIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
`

function Badge({ text, color }: { text: string; color: 'green' | 'blue' | 'yellow' | 'neutral' }) {
  const cls = {
    green: 'bg-emerald-950 text-emerald-300',
    blue: 'bg-blue-950 text-blue-300',
    yellow: 'bg-yellow-950 text-yellow-300',
    neutral: 'bg-neutral-800 text-neutral-400',
  }[color]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${cls}`}>{text}</span>
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

// ── Edit modal ─────────────────────────────────────────────────────────────
// Uses native <select> elements — avoids nested base-ui portal breakage.
function EditModal({
  user,
  open,
  onClose,
  onSave,
  onCancel,
}: {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onSave: (user: AdminUser, changes: { role: 'user' | 'admin'; plan: 'pro' | 'starter' | '' }) => Promise<void>
  onCancel: (user: AdminUser) => void
}) {
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [plan, setPlan] = useState<'pro' | 'starter' | ''>('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !user) return
    setRole(user.role as 'user' | 'admin')
    setPlan((user.subscription?.planSlug as 'pro' | 'starter') ?? '')
    setConfirmCancel(false)
    setErr(null)
  }, [open, user])

  if (!user) return null

  const handleSave = async () => {
    setSaving(true)
    setErr(null)
    try {
      await onSave(user, { role, plan })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent showCloseButton className="max-w-sm overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Email — locked */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              readOnly
              value={user.email}
              className="w-full rounded-lg bg-neutral-800/40 px-3 py-2 text-sm text-neutral-500 outline-none cursor-not-allowed select-none"
            />
          </div>

          {/* Username — locked */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Username</label>
            <input
              readOnly
              value={user.username}
              className="w-full rounded-lg bg-neutral-800/40 px-3 py-2 text-sm text-neutral-400 outline-none cursor-not-allowed select-none"
            />
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Role</label>
            <Select<'user' | 'admin'> value={role} onValueChange={(v) => { if (v) setRole(v) }}>
              <SelectTrigger className="h-9 w-full gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-200 outline-none focus:border-neutral-500">
                <SelectValue />
                <SelectIcon className="ml-auto"><ChevronDown className="h-3.5 w-3.5 text-neutral-500" /></SelectIcon>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plan */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Plan</label>
            <Select<'pro' | 'starter' | ''> value={plan} onValueChange={(v) => setPlan(v ?? '')}>
              <SelectTrigger className="h-9 w-full gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-200 outline-none focus:border-neutral-500">
                <SelectValue placeholder="No plan" />
                <SelectIcon className="ml-auto"><ChevronDown className="h-3.5 w-3.5 text-neutral-500" /></SelectIcon>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No plan</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cancel subscription (destructive, separate from save) */}
          {user.subscription?.status === 'active' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Active until {formatExpiry(user.subscription.expiresAt ?? null)}
              </p>
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="w-full rounded-lg bg-red-950/30 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/50"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="space-y-2 rounded-lg bg-red-950/20 p-3 ring-1 ring-red-900/50">
                  <p className="text-xs text-red-300">Removes access immediately. Confirm?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="flex-1 rounded bg-neutral-800 py-1.5 text-xs hover:bg-neutral-700"
                    >
                      Keep it
                    </button>
                    <button
                      onClick={() => { onCancel(user); onClose() }}
                      className="flex-1 rounded bg-red-600 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Yes, cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
          <DialogClose
            render={<button className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700" />}
          >
            Cancel
          </DialogClose>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete confirm modal ───────────────────────────────────────────────────
function DeleteModal({
  user,
  open,
  busy,
  onClose,
  onConfirm,
}: {
  user: AdminUser | null
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (user: AdminUser) => void
}) {
  if (!user) return null
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This permanently deletes{' '}
            <span className="font-medium text-foreground">{user.email}</span> and all their data.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800" />
            }
          >
            Cancel
          </DialogClose>
          <button
            onClick={() => onConfirm(user)}
            disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | 'admin' | 'user'>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ kind: 'error' | 'notice'; text: string } | null>(null)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
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

  const saveUser = async (
    user: AdminUser,
    changes: { role: 'user' | 'admin'; plan: 'pro' | 'starter' | '' },
  ) => {
    const ops: Promise<unknown>[] = []
    if (changes.role !== user.role) {
      ops.push(setUserRole(user.id, changes.role))
    }
    const currentPlan = (user.subscription?.planSlug ?? '') as 'pro' | 'starter' | ''
    if (changes.plan !== currentPlan) {
      if (changes.plan) {
        ops.push(manageUserSubscription(user.id, 'grant', changes.plan))
      } else {
        ops.push(manageUserSubscription(user.id, 'cancel'))
      }
    }
    await Promise.all(ops)
    await load(page, search, roleFilter)
    setActionMsg({ kind: 'notice', text: `Saved ${user.email}` })
  }

  const cancelSub = (user: AdminUser) => {
    void run(
      () => manageUserSubscription(user.id, 'cancel'),
      `Subscription cancelled for ${user.email}`,
    )
  }

  const deleteUser = (user: AdminUser) => {
    void run(
      async () => { await deleteAdminUser(user.id); setDeleteTarget(null) },
      `Deleted ${user.email}`,
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
    <>
      <style>{css}</style>
      <div className="space-y-6">
        <header className="animate-in" style={{ animationDelay: '0ms' }}>
          <h1 className="text-3xl tracking-wide text-white" style={{ fontFamily: "'Bowlby One', sans-serif" }}>Users</h1>
          {data && <p className="mt-1 text-sm text-neutral-500">{data.total} total</p>}
        </header>

        {/* Search + filter */}
        <div className="animate-in flex flex-wrap gap-3" style={{ animationDelay: '80ms' }}>
          <input
            type="search"
            placeholder="Search email or username…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-9 w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-500"
          />
          <Select<'' | 'admin' | 'user'>
            value={roleFilter}
            onValueChange={(v) => { setRoleFilter(v ?? ''); setPage(1) }}
          >
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
            className={`animate-in flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
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
            <div
              className="animate-in overflow-x-auto rounded-xl border border-neutral-800"
              style={{ animationDelay: '140ms' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-neutral-500">
                    <th className="px-4 py-3 font-normal">Email</th>
                    <th className="px-4 py-3 font-normal">Role</th>
                    <th className="px-4 py-3 font-normal">Plan</th>
                    <th className="px-4 py-3 font-normal">Expires</th>
                    <th className="px-4 py-3 font-normal"></th>
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
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditTarget(user)}
                            title="Edit user"
                            aria-label="Edit user"
                            className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            title="Delete user"
                            aria-label="Delete user"
                            className="flex h-7 w-7 items-center justify-center rounded text-red-500/50 transition-colors hover:bg-red-950/30 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

        <EditModal
          user={editTarget}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
          onSave={saveUser}
          onCancel={cancelSub}
        />

        <DeleteModal
          user={deleteTarget}
          open={deleteTarget !== null}
          busy={busy}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteUser}
        />
      </div>
    </>
  )
}
