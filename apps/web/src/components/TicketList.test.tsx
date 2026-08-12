import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TicketList from './TicketList'
import type { Ticket } from '../api/tickets'

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    key: 'RCH-101',
    summary: 'Add export to CSV feature',
    description: 'Some description',
    url: 'https://linear.app/runchise/issue/RCH-101',
    status: 'backlog',
    stage: null,
    prDescription: null,
    startedAt: null,
    finishedAt: null,
    priority: 'High',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('TicketList', () => {
  it('renders a table with header columns', () => {
    render(
      <TicketList tickets={[]} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText('Key')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Stage')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('renders all tickets as rows', () => {
    const tickets = [
      makeTicket({ key: 'RCH-101', summary: 'First ticket', status: 'backlog' }),
      makeTicket({ key: 'RCH-102', summary: 'Second ticket', status: 'in_progress', stage: 'implement' }),
      makeTicket({ key: 'RCH-103', summary: 'Third ticket', status: 'done' }),
    ]

    render(
      <TicketList tickets={tickets} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText('RCH-101')).toBeInTheDocument()
    expect(screen.getByText('RCH-102')).toBeInTheDocument()
    expect(screen.getByText('RCH-103')).toBeInTheDocument()
    expect(screen.getByText('First ticket')).toBeInTheDocument()
    expect(screen.getByText('Second ticket')).toBeInTheDocument()
    expect(screen.getByText('Third ticket')).toBeInTheDocument()
  })

  it('shows empty state when no tickets', () => {
    render(
      <TicketList tickets={[]} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText(/no tickets/i)).toBeInTheDocument()
  })

  it('calls onOpenTicket when a row is clicked', async () => {
    const onOpenTicket = vi.fn()
    const ticket = makeTicket({ key: 'RCH-101' })
    const user = userEvent.setup()

    render(
      <TicketList tickets={[ticket]} onOpenTicket={onOpenTicket} />,
    )

    await user.click(screen.getByText('RCH-101'))
    expect(onOpenTicket).toHaveBeenCalledWith(ticket)
  })

  it('calls onDeleteTicket when delete action is clicked', async () => {
    const onDeleteTicket = vi.fn()
    const ticket = makeTicket({ key: 'RCH-101' })
    const user = userEvent.setup()

    render(
      <TicketList tickets={[ticket]} onOpenTicket={vi.fn()} onDeleteTicket={onDeleteTicket} />,
    )

    // Find the row containing RCH-101 and click delete within it
    const row = screen.getByText('RCH-101').closest('tr')!
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    expect(onDeleteTicket).toHaveBeenCalledWith(ticket)
  })

  it('shows status with correct styling', () => {
    const tickets = [
      makeTicket({ key: 'RCH-101', status: 'backlog' }),
      makeTicket({ key: 'RCH-102', status: 'in_progress' }),
      makeTicket({ key: 'RCH-103', status: 'blocked' }),
      makeTicket({ key: 'RCH-104', status: 'done' }),
    ]

    render(
      <TicketList tickets={tickets} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('shows stage badge for in-progress tickets', () => {
    const tickets = [
      makeTicket({ key: 'RCH-101', status: 'in_progress', stage: 'judge' }),
      makeTicket({ key: 'RCH-102', status: 'in_progress', stage: 'implement' }),
    ]

    render(
      <TicketList tickets={tickets} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText('Judge')).toBeInTheDocument()
    expect(screen.getByText('Implement')).toBeInTheDocument()
  })

  it('shows priority when present', () => {
    const tickets = [
      makeTicket({ key: 'RCH-101', priority: 'Highest' }),
      makeTicket({ key: 'RCH-102', priority: null }),
    ]

    render(
      <TicketList tickets={tickets} onOpenTicket={vi.fn()} />,
    )

    expect(screen.getByText('Highest')).toBeInTheDocument()
  })
})
