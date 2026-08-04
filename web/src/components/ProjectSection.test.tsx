import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import ProjectSection from './ProjectSection'
import type { Project } from '../api/projects'
import type { IntegrationItem } from '../api/integrations'

const readyProject: Project = {
  id: 'abc-123',
  provider: 'github',
  owner: 'acme',
  repoSlug: 'widgets',
  defaultBranch: 'main',
  cloneStatus: 'ready',
  cloneError: null,
  connectedAt: '2026-08-04T00:00:00.000Z',
}

const githubConnected: IntegrationItem = {
  id: 'github',
  name: 'GitHub',
  connected: true,
  authType: 'oauth',
  models: [],
}

const githubDisconnected: IntegrationItem = { ...githubConnected, connected: false }

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockFetchRouter(handlers: Record<string, () => Response | Promise<Response>>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : String(input)
    const pathOnly = url.split('?')[0]!
    const key = Object.keys(handlers).find((k) => url.startsWith(k) || pathOnly === k)
    if (key) return handlers[key]!()
    throw new Error(`unhandled fetch: ${url}`)
  })
}

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

describe('ProjectSection', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows provider picker when no project connected and no provider connected', async () => {
    mockFetchRouter({
      '/api/projects/current': () => jsonResponse(null),
      '/api/integrations': () => jsonResponse([githubDisconnected]),
    })

    render(<ProjectSection />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    })
    expect(screen.getByText('Bitbucket')).toBeInTheDocument()
  })

  it('shows org/repo picker once a provider is connected but no project chosen', async () => {
    mockFetchRouter({
      '/api/projects/current': () => jsonResponse(null),
      '/api/integrations': () => jsonResponse([githubConnected]),
      '/api/projects/orgs': () => jsonResponse([{ slug: 'acme', name: 'acme', isPersonal: false }]),
      '/api/projects/repos': () =>
        jsonResponse({ repos: [{ owner: 'acme', slug: 'widgets', defaultBranch: 'main' }], nextPage: null }),
    })

    render(<ProjectSection />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('widgets')).toBeInTheDocument()
    })
  })

  it('shows collapsed connected summary when a project is ready', async () => {
    mockFetchRouter({
      '/api/projects/current': () => jsonResponse(readyProject),
      '/api/integrations': () => jsonResponse([githubConnected]),
    })

    render(<ProjectSection />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('acme/widgets')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Change project' })).toBeInTheDocument()
  })

  it('shows cloning state while cloneStatus is cloning', async () => {
    mockFetchRouter({
      '/api/projects/current': () => jsonResponse({ ...readyProject, cloneStatus: 'cloning' }),
      '/api/integrations': () => jsonResponse([githubConnected]),
    })

    render(<ProjectSection />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/setting up project/i)).toBeInTheDocument()
    })
  })

  it('shows failed state with a "Back to repos" action', async () => {
    mockFetchRouter({
      '/api/projects/current': () =>
        jsonResponse({ ...readyProject, cloneStatus: 'failed', cloneError: 'authentication failed' }),
      '/api/integrations': () => jsonResponse([githubConnected]),
    })

    render(<ProjectSection />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Back to repos' })).toBeInTheDocument()
  })

  it('clicking Change project opens a confirmation dialog before clearing', async () => {
    mockFetchRouter({
      '/api/projects/current': () => jsonResponse(readyProject),
      '/api/integrations': () => jsonResponse([githubConnected]),
    })
    const user = userEvent.setup()

    render(<ProjectSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('acme/widgets')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Change project' }))

    expect(screen.getByText(/this will delete/i)).toBeInTheDocument()
  })
})
