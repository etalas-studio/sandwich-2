import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateTicketModal from './CreateTicketModal'

describe('CreateTicketModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CreateTicketModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} error={null} isPending={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders form fields when open', () => {
    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} error={null} isPending={false} />,
    )
    expect(screen.getByLabelText('Key')).toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeInTheDocument()
  })

  it('calls onSubmit with form data when submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={false} />,
    )

    await user.type(screen.getByLabelText('Key'), 'RR-7000')
    await user.type(screen.getByLabelText('Summary'), 'Fix bug')
    await user.type(screen.getByLabelText('Description'), 'The bug is fixed.')
    await user.type(screen.getByLabelText('URL'), 'https://jira.example.com/RR-7000')
    await user.click(screen.getByRole('button', { name: 'Create ticket' }))

    expect(onSubmit).toHaveBeenCalledWith({
      key: 'RR-7000',
      summary: 'Fix bug',
      description: 'The bug is fixed.',
      url: 'https://jira.example.com/RR-7000',
    })
  })

  it('does not call onSubmit while isPending', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={true} />,
    )

    await user.type(screen.getByLabelText('Key'), 'X')
    await user.type(screen.getByLabelText('Summary'), 'Y')
    await user.type(screen.getByLabelText('Description'), 'Z')
    await user.click(screen.getByRole('button', { name: 'Creating…' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows error message when provided', () => {
    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} error="key already exists" isPending={false} />,
    )
    expect(screen.getByText('key already exists')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={onClose} onSubmit={vi.fn()} error={null} isPending={false} />,
    )

    // Click the backdrop (first child of the fragment)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/60')
    if (backdrop) await user.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
