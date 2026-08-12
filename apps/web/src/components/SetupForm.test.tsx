import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetupForm from './SetupForm'

describe('SetupForm', () => {
  it('renders username, email, password inputs and a submit button', () => {
    render(
      <SetupForm onSubmit={vi.fn()} error={null} isPending={false} onBack={vi.fn()} />,
    )

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buat akun' })).toBeInTheDocument()
  })

  it('calls onSubmit with username, email, and password when submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <SetupForm onSubmit={onSubmit} error={null} isPending={false} onBack={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Email'), 'bob@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Buat akun' }))

    expect(onSubmit).toHaveBeenCalledWith('bob', 'bob@test.com', 'secret123')
  })

  it('does not call onSubmit while isPending is true', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <SetupForm onSubmit={onSubmit} error={null} isPending={true} onBack={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Email'), 'bob@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Membuat akun…' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows pending state on button when isPending is true', () => {
    render(
      <SetupForm onSubmit={vi.fn()} error={null} isPending={true} onBack={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Membuat akun…' })).toBeDisabled()
  })

  it('displays error message when error prop is provided', () => {
    render(
      <SetupForm
        onSubmit={vi.fn()}
        error="username taken"
        isPending={false}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText('username taken')).toBeInTheDocument()
  })
})
