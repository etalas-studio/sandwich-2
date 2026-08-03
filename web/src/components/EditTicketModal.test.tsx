import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditTicketModal from './EditTicketModal'
import type { Ticket } from '../api/tickets'

const ticket: Ticket = {
  key: 'RR-1234',
  description: 'Original description.',
  url: 'https://example.com',
  status: 'backlog',
  stage: null,
  needsHumanCategory: null,
  needsHumanReason: null,
  prUrl: null,
  prSummary: null,
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('EditTicketModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <EditTicketModal open={false} ticket={ticket} onClose={vi.fn()} onSubmit={vi.fn()} error={null} isPending={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders form fields pre-filled from ticket', () => {
    render(
      <EditTicketModal open={true} ticket={ticket} onClose={vi.fn()} onSubmit={vi.fn()} error={null} isPending={false} />,
    )
    const descField = screen.getByPlaceholderText('Steps to reproduce…') as HTMLTextAreaElement
    expect(descField.value).toBe('Original description.')
    const urlField = screen.getByPlaceholderText('https://runchise.atlassian.net/browse/RR-7000') as HTMLInputElement
    expect(urlField.value).toBe('https://example.com')
    expect(screen.getByText('RR-1234')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('calls onSubmit with updated data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <EditTicketModal open={true} ticket={ticket} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={false} />,
    )

    const descField = screen.getByPlaceholderText('Steps to reproduce…')
    await user.clear(descField)
    await user.type(descField, 'Updated description.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSubmit).toHaveBeenCalledWith(ticket.key, {
      description: 'Updated description.',
      url: 'https://example.com',
      status: 'backlog',
    })
  })

  it('shows error when provided', () => {
    render(
      <EditTicketModal open={true} ticket={ticket} onClose={vi.fn()} onSubmit={vi.fn()} error="Update failed" isPending={false} />,
    )
    expect(screen.getByText('Update failed')).toBeInTheDocument()
  })

  it('disables submit while pending', () => {
    render(
      <EditTicketModal open={true} ticket={ticket} onClose={vi.fn()} onSubmit={vi.fn()} error={null} isPending={true} />,
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
