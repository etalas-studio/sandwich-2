import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from './Modal'
import type { Ticket, UpdateTicketData } from '../api/tickets'

interface EditTicketModalProps {
  open: boolean
  ticket: Ticket
  onClose: () => void
  onSubmit: (key: string, data: UpdateTicketData) => Promise<void>
  error: string | null
  isPending: boolean
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

export default function EditTicketModal({ open, ticket, onClose, onSubmit, error, isPending }: EditTicketModalProps) {
  const [description, setDescription] = useState(ticket.description)
  const [url, setUrl] = useState(ticket.url ?? '')
  const [status, setStatus] = useState(ticket.status)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit(ticket.key, {
      description: description.trim() || undefined,
      url: url.trim() || null,
      status,
    })
  }

  const handleClose = () => {
    if (isPending) return
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit Ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Key (read-only) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">ID</span>
          <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/40 text-sm font-mono">
            {ticket.key}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Steps to reproduce…"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://runchise.atlassian.net/browse/RR-7000"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-[#ff8a8a]">{error}</p>}

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-b from-[#333] to-[#111] border border-white/10 text-white text-sm disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
