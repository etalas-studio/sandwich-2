import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import Modal from './Modal'

export const ticketFormSchema = z.object({
  id: z.string().trim().optional().default(''),
  description: z.string().trim().min(1, 'Description is required'),
  url: z.string().trim().optional().default(''),
})

export type CreateTicketData = z.infer<typeof ticketFormSchema>

interface CreateTicketModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateTicketData) => Promise<void>
  error: string | null
  isPending: boolean
}

type FieldErrors = Partial<Record<keyof CreateTicketData, string>>

export default function CreateTicketModal({ open, onClose, onSubmit, error, isPending }: CreateTicketModalProps) {
  const [id, setId] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return

    const result = ticketFormSchema.safeParse({ id, description, url })
    if (!result.success) {
      const errors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CreateTicketData
        if (!errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    void onSubmit(result.data)
  }

  const handleClose = () => {
    if (isPending) return
    setId('')
    setDescription('')
    setUrl('')
    setFieldErrors({})
    onClose()
  }

  const inputClass = (field: keyof CreateTicketData) =>
    `px-3 py-2 rounded-lg bg-white/[0.03] border text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 ${
      fieldErrors[field] ? 'border-[#ff8a8a]/50' : 'border-white/[0.08]'
    }`

  const labelText = (label: string, required: boolean) => (
    <span className="text-sm text-white/70">
      {label}{required && <span className="text-[#ff8a8a] ml-0.5">*</span>}
    </span>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Add Ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          {labelText('ID', false)}
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoFocus
            placeholder="RR-7000 (auto-generated if blank)"
            className={inputClass('id')}
          />
          {fieldErrors.id && <p className="text-xs text-[#ff8a8a]">{fieldErrors.id}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          {labelText('Description', true)}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Steps to reproduce…"
            className={`${inputClass('description')} resize-none`}
          />
          {fieldErrors.description && <p className="text-xs text-[#ff8a8a]">{fieldErrors.description}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          {labelText('URL', false)}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://runchise.atlassian.net/browse/RR-7000"
            className={inputClass('url')}
          />
          {fieldErrors.url && <p className="text-xs text-[#ff8a8a]">{fieldErrors.url}</p>}
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
