import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import * as useAuthModule from '../hooks/useAuth'

function setup(status: 'authenticated' | 'unauthenticated' | 'loading') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    state: status === 'authenticated'
      ? { status: 'authenticated', id: 'u1', username: 'alice' }
      : { status: 'unauthenticated' },
    isLoading: status === 'loading',
    login: vi.fn(), loginError: null, loginPending: false,
    register: vi.fn(), registerError: null, registerPending: false,
    logout: vi.fn(),
  })
}

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    setup('authenticated')
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('protected')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    setup('unauthenticated')
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('renders nothing (blank) while loading', () => {
    setup('loading')
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeEmptyDOMElement()
  })
})
