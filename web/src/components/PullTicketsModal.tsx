import { useState, useEffect, useRef, useCallback } from 'react'
import { XIcon, SearchIcon } from 'lucide-react'

export interface JiraTicket {
  key: string
  summary: string
  description: string
  status: string
  issueType: string
  priority: string | null
  sprint: string | null
  assignee: string | null
}

interface PreviewResponse {
  issues: JiraTicket[]
  total: number
  startAt: number
}

interface PullTicketsModalProps {
  open: boolean
  onClose: () => void
  onImport: (tickets: JiraTicket[]) => void
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '\u2026'
}

const STATUS_OPTIONS = ['', 'To Do', 'In Progress', 'Done', 'Blocked']
const TYPE_OPTIONS = ['', 'Story', 'Bug', 'Task', 'Subtask', 'Epic']
const PRIORITY_OPTIONS = ['', 'Highest', 'High', 'Medium', 'Low', 'Lowest']

export default function PullTicketsModal({ open, onClose, onImport }: PullTicketsModalProps) {
  const [tickets, setTickets] = useState<JiraTicket[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [total, setTotal] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterSprint, setFilterSprint] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const buildUrl = useCallback((atStart: number) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    if (filterType) params.set('issueType', filterType)
    if (filterPriority) params.set('priority', filterPriority)
    if (filterAssignee) params.set('assignee', filterAssignee)
    if (filterSprint) params.set('sprint', filterSprint)
    params.set('startAt', String(atStart))
    params.set('maxResults', '50')
    return `/api/tickets/pull/preview?${params.toString()}`
  }, [search, filterStatus, filterType, filterPriority, filterAssignee, filterSprint])

  const doFetch = useCallback(async (atStart: number, append: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!append) {
      setStatus('loading')
      setTickets([])
    } else {
      setLoadingMore(true)
    }
    setErrorMessage('')

    try {
      const res = await fetch(buildUrl(atStart), { signal: controller.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as PreviewResponse
      setTickets((prev) => append ? [...prev, ...data.issues] : data.issues)
      setTotal(data.total)
      setStartAt(data.startAt + data.issues.length)
      if (!append) setStatus('ready')
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch tickets')
    } finally {
      setLoadingMore(false)
    }
  }, [buildUrl])

  // Fetch on open + when filters change (debounced)
  useEffect(() => {
    if (!open) return

    // Reset
    setSelectedKeys(new Set())

    // Debounce filter changes
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doFetch(0, false)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, search, filterStatus, filterType, filterPriority, filterAssignee, filterSprint, doFetch])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function loadMore() {
    doFetch(startAt, true)
  }

  function toggleAll() {
    const allSelected = tickets.length > 0 && tickets.every((t) => selectedKeys.has(t.key))
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        for (const t of tickets) next.delete(t.key)
        return next
      })
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        for (const t of tickets) next.add(t.key)
        return next
      })
    }
  }

  function toggleOne(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleImport() {
    // Collect selected from all loaded tickets
    const selected = tickets.filter((t) => selectedKeys.has(t.key))
    if (selected.length > 0) {
      onImport(selected)
      onClose()
    }
  }

  if (!open) return null

  const allSelected = tickets.length > 0 && tickets.every((t) => selectedKeys.has(t.key))
  const selectedCount = selectedKeys.size
  const hasMore = startAt < total

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl max-h-[90vh] flex flex-col ds-card-outer ds-shadow-elevated">
          <div className="ds-card-inner flex flex-col overflow-hidden" style={{ height: 'auto', maxHeight: '90vh' }}>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-5 pb-4 border-b border-white/[0.04] shrink-0">
              <div>
                <h2 className="text-lg font-normal text-white ds-text-shadow">Pull Tickets from Jira</h2>
                <p className="text-xs text-white/40 font-light mt-0.5">
                  Search and filter, then select tickets to import.
                </p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Filter bar */}
            <div className="relative z-10 px-5 py-3 border-b border-white/[0.04] shrink-0 space-y-2">
              {/* Search + quick filters row 1 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search tickets…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white/80 placeholder:text-white/30 font-light outline-none focus:border-white/[0.15] transition-colors"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 font-light outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o} className="bg-[#1a1a1a]">{o || 'All statuses'}</option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 font-light outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o} className="bg-[#1a1a1a]">{o || 'All types'}</option>
                  ))}
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 font-light outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o} value={o} className="bg-[#1a1a1a]">{o || 'All priorities'}</option>
                  ))}
                </select>
              </div>
              {/* Filter row 2: assignee + sprint */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Assignee…"
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 font-light outline-none focus:border-white/[0.15] transition-colors"
                />
                <input
                  type="text"
                  placeholder="Sprint…"
                  value={filterSprint}
                  onChange={(e) => setFilterSprint(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 font-light outline-none focus:border-white/[0.15] transition-colors"
                />
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1 overflow-y-auto hide-scrollbar">
              {status === 'loading' && (
                <div className="flex items-center gap-3 p-8 justify-center">
                  <iconify-icon icon="solar:refresh-linear" width="18" className="text-white/60 animate-spin" />
                  <span className="text-sm text-white/40 font-light">Loading tickets from Jira…</span>
                </div>
              )}

              {status === 'error' && (
                <div className="p-8 text-center">
                  <p className="text-sm text-[#ff8a8a] font-light mb-1">Failed to fetch tickets</p>
                  <p className="text-xs text-white/40 font-light">{errorMessage}</p>
                </div>
              )}

              {status === 'ready' && tickets.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-sm text-white/40 font-light">No tickets match your filters.</p>
                </div>
              )}

              {status === 'ready' && tickets.length > 0 && (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02] sticky top-0">
                      <th className="text-left px-4 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                          className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-[#f59e0b] cursor-pointer"
                        />
                      </th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Key</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Summary</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Status</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Type</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Priority</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Sprint</th>
                      <th className="text-left px-3 py-2.5 text-[10px] text-white/40 font-normal uppercase tracking-wider">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.key}
                        className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(ticket.key)}
                            onChange={() => toggleOne(ticket.key)}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-[#f59e0b] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/40 font-mono">{ticket.key}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-xs">
                          <div>
                            <span className="text-xs text-white/70 font-light line-clamp-2">{ticket.summary}</span>
                            {ticket.description && (
                              <span className="text-[10px] text-white/30 font-light line-clamp-1 block mt-0.5">
                                {truncate(ticket.description, 80)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/50 font-light">{ticket.status}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/50 font-light">{ticket.issueType}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/50 font-light">{ticket.priority || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/50 font-light">{ticket.sprint || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-white/50 font-light">{ticket.assignee || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Load More */}
              {status === 'ready' && hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 rounded-lg text-xs font-light text-white/60 hover:text-white/80 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors disabled:opacity-40"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <iconify-icon icon="solar:refresh-linear" width="12" className="animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      `Load More (${total - tickets.length} remaining)`
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative z-10 flex items-center justify-between p-4 pt-3 border-t border-white/[0.04] bg-gradient-to-t from-[#0f0f0f] to-[#0a0a0a] shrink-0">
              <span className="text-xs text-white/40 font-light">
                {selectedCount} of {total} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-light text-white/50 hover:text-white/70 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="relative inline-flex group disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                  <span
                    className="relative flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                    style={{
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    <iconify-icon icon="solar:import-linear" width="13" className="text-white/80" />
                    Import {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
