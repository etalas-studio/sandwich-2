import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'
import LoginForm from './LoginForm'
import App from '../App'
import LandingPage from './LandingPage'

const RETURN_TO_KEY = 'sandwich_return_to'

export default function AuthGate() {
  const {
    state,
    isLoading,
    login,
    loginError,
    loginPending,
    register,
    registerError,
    registerPending,
    logout,
  } = useAuth()

  const location = useLocation()
  const navigate = useNavigate()
  const [forceView, setForceView] = React.useState<'login' | 'register' | null>(null)

  // After login/register succeeds, restore the page they were trying to reach
  React.useEffect(() => {
    if (state.status === 'authenticated') {
      setForceView(null)
      const returnTo = sessionStorage.getItem(RETURN_TO_KEY)
      if (returnTo) {
        sessionStorage.removeItem(RETURN_TO_KEY)
        navigate(returnTo, { replace: true })
      }
    }
  }, [state.status, navigate])

  // ── Landing page — always accessible ────────────────────────────────────
  if (location.pathname === '/') {
    return (
      <LandingPage
        onGoToApp={(plan) => navigate(plan ? `/checkout?plan=${plan}` : '/checkout')}
      />
    )
  }

  if (isLoading) {
    return <div className="ds-bg min-h-screen" />
  }

  // ── Dashboard — requires auth + paid plan ────────────────────────────────
  if (location.pathname.startsWith('/dashboard')) {
    if (state.status === 'unauthenticated') {
      // Save where they were so we can send them back after login
      sessionStorage.setItem(RETURN_TO_KEY, location.pathname + location.search)
      // Session expired → default to Login (not Register)
      if (forceView === 'register') {
        return <SetupForm onSubmit={register} error={registerError} isPending={registerPending} onBack={() => navigate('/')} onSwitchToLogin={() => setForceView('login')} />
      }
      return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView('register')} />
    }
    if (!localStorage.getItem('sandwich_paid_plan')) {
      navigate('/checkout', { replace: true })
      return null
    }
    const username = state.status === 'authenticated' ? state.username : ''
    return <App username={username} onLogout={() => { void logout(); navigate('/') }} />
  }

  // ── Checkout ─────────────────────────────────────────────────────────────
  if (location.pathname.startsWith('/checkout')) {
    const searchParams = new URLSearchParams(location.search)
    const isUpgrade = searchParams.get('from') === 'dashboard'
    const hasPlan = !!localStorage.getItem('sandwich_paid_plan')

    if (state.status === 'unauthenticated') {
      // New user flow: default Register; existing user can switch to Login
      if (forceView === 'login') {
        return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView('register')} />
      }
      return <SetupForm onSubmit={register} error={registerError} isPending={registerPending} onBack={() => navigate('/')} onSwitchToLogin={() => setForceView('login')} />
    }

    // Authenticated + has plan + NOT an upgrade → skip to dashboard
    if (hasPlan && !isUpgrade) {
      navigate('/dashboard', { replace: true })
      return null
    }

    // Authenticated (new user without plan, or upgrade) → show CheckoutPage
    const username = state.status === 'authenticated' ? state.username : ''
    return <App username={username} onLogout={() => { void logout(); navigate('/') }} />
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  if (state.status === 'unauthenticated') {
    return (
      <LoginForm
        onSubmit={login}
        error={loginError}
        isPending={loginPending}
        onBack={() => navigate('/')}
        onSwitchToRegister={() => setForceView('register')}
      />
    )
  }

  const username = state.status === 'authenticated' ? state.username : ''
  return <App username={username} onLogout={logout} />
}
