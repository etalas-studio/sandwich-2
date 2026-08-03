import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from './Modal'

export interface CreateTicketData {
  key: string
  summary: string
  description: string
  url: string
}

interface CreateTicketModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateTicketData) => Promise<void>
  error: string | null
  isPending: boolean
}

export default function CreateTicketModal({ open, onClose, onSubmit, error, isPending }: CreateTicketModalProps) {
  const [key, setKey] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit({ key: key.trim(), summary: summary.trim(), description: description.trim(), url: url.trim() })
  }

  const handleClose = () => {
    if (isPending) return
    setKey('')
    setSummary('')
    setDescription('')
    setUrl('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-white/70">
          Key
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            autoFocus
            placeholder="RR-7000"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-white/70">
          Summary
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
            placeholder="Fix the export header bug"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-white/70">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Steps to reproduce…"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-white/70">
          URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://runchise.atlassian.net/browse/RR-7000"
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </label>

        {error && <p className="text-sm text-[#ff8a8a]">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-b from-[#333] to-[#111] border border-white/10 text-white text-sm disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create ticket'}
        </button>
      </form>
    </Modal>
  )
}
