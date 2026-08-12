import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDeleteModal from './ConfirmDeleteModal'

describe('ConfirmDeleteModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDeleteModal open={false} itemName="RR-1234" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows item name and buttons when open', () => {
    render(
      <ConfirmDeleteModal open={true} itemName="RR-1234" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('RR-1234')).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onConfirm when delete button clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDeleteModal open={true} itemName="X" onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDeleteModal open={true} itemName="X" onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
