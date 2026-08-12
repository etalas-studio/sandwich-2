import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './LoginForm'

describe('LoginForm', () => {
  it('renders username and password inputs and a submit button', () => {
    render(
      <LoginForm onSubmit={vi.fn()} error={null} isPending={false} onBack={vi.fn()} />,
    )

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('calls onSubmit with username and password when submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <LoginForm onSubmit={onSubmit} error={null} isPending={false} onBack={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(onSubmit).toHaveBeenCalledWith('alice', 'secret')
  })

  it('does not call onSubmit while isPending is true', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <LoginForm onSubmit={onSubmit} error={null} isPending={true} onBack={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Logging in…' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the submit button in pending state when isPending is true', () => {
    render(
      <LoginForm onSubmit={vi.fn()} error={null} isPending={true} onBack={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled()
  })

  it('displays error message when error prop is provided', () => {
    render(
      <LoginForm
        onSubmit={vi.fn()}
        error="invalid credentials"
        isPending={false}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('invalid credentials')).toBeInTheDocument()
  })

  it('does not display error when error prop is null', () => {
    render(
      <LoginForm onSubmit={vi.fn()} error={null} isPending={false} onBack={vi.fn()} />,
    )

    expect(screen.queryByText(/invalid/)).not.toBeInTheDocument()
  })
})
