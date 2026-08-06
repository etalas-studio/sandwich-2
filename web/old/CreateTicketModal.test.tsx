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
    expect(screen.getByPlaceholderText('RR-7000 (auto-generated if blank)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Steps to reproduce…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('https://runchise.atlassian.net/browse/RR-7000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeInTheDocument()
    // Description has required asterisk
    expect(screen.getByText(/Description/).textContent).toContain('*')
  })

  it('calls onSubmit with form data when submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={false} />,
    )

    await user.type(screen.getByPlaceholderText('RR-7000 (auto-generated if blank)'), 'RR-7000')
    await user.type(screen.getByPlaceholderText('Steps to reproduce…'), 'The bug is fixed.')
    await user.type(screen.getByPlaceholderText('https://runchise.atlassian.net/browse/RR-7000'), 'https://jira.example.com/RR-7000')
    await user.click(screen.getByRole('button', { name: 'Create ticket' }))

    expect(onSubmit).toHaveBeenCalledWith({
      id: 'RR-7000',
      description: 'The bug is fixed.',
      url: 'https://jira.example.com/RR-7000',
    })
  })

  it('submits with empty id and url (both optional)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={false} />,
    )

    await user.type(screen.getByPlaceholderText('Steps to reproduce…'), 'Just a description.')
    await user.click(screen.getByRole('button', { name: 'Create ticket' }))

    expect(onSubmit).toHaveBeenCalledWith({
      id: '',
      description: 'Just a description.',
      url: '',
    })
  })

  it('shows validation error when description is empty', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={false} />,
    )

    await user.click(screen.getByRole('button', { name: 'Create ticket' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Description is required')).toBeInTheDocument()
  })

  it('does not call onSubmit while isPending', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={onSubmit} error={null} isPending={true} />,
    )

    await user.type(screen.getByPlaceholderText('Steps to reproduce…'), 'Z')
    await user.click(screen.getByRole('button', { name: 'Creating…' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows error message when provided', () => {
    render(
      <CreateTicketModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} error="id already exists" isPending={false} />,
    )
    expect(screen.getByText('id already exists')).toBeInTheDocument()
  })
})
