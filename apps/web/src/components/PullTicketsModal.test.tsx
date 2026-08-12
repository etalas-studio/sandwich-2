import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PullTicketsModal from './PullTicketsModal'
import type { JiraTicket } from './PullTicketsModal'

function makeJiraTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    key: 'RR-100',
    summary: 'Fix login bug',
    description: 'Users cannot login with SSO.',
    status: 'To Do',
    issueType: 'Bug',
    priority: 'High',
    sprint: 'Sprint 5',
    assignee: 'John Doe',
    ...overrides,
  }
}

function mockPreviewResponse(tickets: JiraTicket[], total = tickets.length) {
  return {
    ok: true,
    json: () => Promise.resolve({ issues: tickets, total, startAt: 0, maxResults: 50 }),
  }
}

describe('PullTicketsModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setFetchResponse(response: unknown) {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(response)
  }

  it('renders nothing when closed', () => {
    const { container } = render(
      <PullTicketsModal open={false} onClose={vi.fn()} onImport={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('fetches and shows tickets when opened', async () => {
    setFetchResponse(mockPreviewResponse([
      makeJiraTicket({ key: 'RR-100', summary: 'Fix login bug' }),
      makeJiraTicket({ key: 'RR-101', summary: 'Add export feature' }),
    ]))

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })
    expect(screen.getByText('RR-101')).toBeInTheDocument()
  })

  it('shows loading state while fetching', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockReturnValue(new Promise(() => {}))

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Auth failed' }) })

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch tickets')).toBeInTheDocument()
    })
  })

  it('allows checking and unchecking tickets', async () => {
    setFetchResponse(mockPreviewResponse([
      makeJiraTicket({ key: 'RR-100' }),
      makeJiraTicket({ key: 'RR-101' }),
    ]))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    const row100 = screen.getByText('RR-100').closest('tr')!
    const row101 = screen.getByText('RR-101').closest('tr')!

    const cb100 = within(row100).getByRole('checkbox')
    const cb101 = within(row101).getByRole('checkbox')

    expect(cb100).not.toBeChecked()
    expect(cb101).not.toBeChecked()

    await user.click(cb100)
    expect(cb100).toBeChecked()

    await user.click(cb100)
    expect(cb100).not.toBeChecked()
  })

  it('has a select all / deselect all checkbox', async () => {
    setFetchResponse(mockPreviewResponse([
      makeJiraTicket({ key: 'RR-100' }),
      makeJiraTicket({ key: 'RR-101' }),
    ]))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    const selectAll = screen.getByRole('checkbox', { name: /select all/i })
    await user.click(selectAll)

    const row100 = screen.getByText('RR-100').closest('tr')!
    const row101 = screen.getByText('RR-101').closest('tr')!

    expect(within(row100).getByRole('checkbox')).toBeChecked()
    expect(within(row101).getByRole('checkbox')).toBeChecked()
  })

  it('triggers server-side search when typing in search box', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(mockPreviewResponse([]))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    // First fetch on open
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'login')

    // Debounced, so wait a bit
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    // Last call should include the search param
    const lastUrl = fetchMock.mock.calls[1]?.[0] as string
    expect(lastUrl).toContain('search=login')
  })

  it('shows Load More button when more tickets available', async () => {
    const tickets = Array.from({ length: 50 }, (_, i) =>
      makeJiraTicket({ key: `RR-${100 + i}` })
    )
    setFetchResponse(mockPreviewResponse(tickets, 120))

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/load more/i)).toBeInTheDocument()
    })
  })

  it('loads more tickets and appends them', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) =>
      makeJiraTicket({ key: `RR-${100 + i}`, summary: `Ticket ${100 + i}` })
    )
    const page2 = [
      makeJiraTicket({ key: 'RR-200', summary: 'Ticket 200' }),
    ]

    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(mockPreviewResponse(page1, 51))
      .mockResolvedValueOnce(mockPreviewResponse(page2, 51))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Ticket 100')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() => {
      expect(screen.getByText('Ticket 200')).toBeInTheDocument()
    })
  })

  it('preserves selection across load more', async () => {
    const tickets = Array.from({ length: 50 }, (_, i) =>
      makeJiraTicket({ key: `RR-${100 + i}`, summary: `Ticket ${i}` })
    )
    const moreTickets = [
      makeJiraTicket({ key: 'RR-200', summary: 'More' }),
    ]

    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(mockPreviewResponse(tickets, 51))
      .mockResolvedValueOnce(mockPreviewResponse(moreTickets, 51))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    // Select first ticket
    const cb100 = within(screen.getByText('RR-100').closest('tr')!).getByRole('checkbox')
    await user.click(cb100)
    expect(cb100).toBeChecked()

    // Load more
    await user.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() => {
      expect(screen.getByText('RR-200')).toBeInTheDocument()
    })

    // First ticket should still be selected
    expect(within(screen.getByText('RR-100').closest('tr')!).getByRole('checkbox')).toBeChecked()
  })

  it('calls onImport with selected tickets', async () => {
    setFetchResponse(mockPreviewResponse([
      makeJiraTicket({ key: 'RR-100' }),
      makeJiraTicket({ key: 'RR-101' }),
    ]))

    const onImport = vi.fn()
    const user = userEvent.setup()

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={onImport} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    // Select first ticket
    const cb100 = within(screen.getByText('RR-100').closest('tr')!).getByRole('checkbox')
    await user.click(cb100)

    await user.click(screen.getByRole('button', { name: /import/i }))

    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ key: 'RR-100' })])
  })

  it('shows ticket details: status, type, priority, sprint, assignee', async () => {
    setFetchResponse(mockPreviewResponse([
      makeJiraTicket({
        key: 'RR-100',
        status: 'To Do',
        issueType: 'Story',
        priority: 'Medium',
        sprint: 'Sprint 5',
        assignee: 'Jane',
      }),
    ]))

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument()
    })
    expect(screen.getByText('Story')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('import button is disabled when nothing selected', async () => {
    setFetchResponse(mockPreviewResponse([makeJiraTicket({ key: 'RR-100' })]))

    render(
      <PullTicketsModal open={true} onClose={vi.fn()} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
  })

  it('closes when cancel is clicked', async () => {
    const onClose = vi.fn()
    setFetchResponse(mockPreviewResponse([makeJiraTicket({ key: 'RR-100' })]))

    const user = userEvent.setup()
    render(
      <PullTicketsModal open={true} onClose={onClose} onImport={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('RR-100')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
