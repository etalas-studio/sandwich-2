import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'
import LoginForm from './LoginForm'
import App from '../App'
import LandingPage from './LandingPage'

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
  // null = show register (default for checkout); 'login' = forced login
  const [forceView, setForceView] = React.useState<'login' | null>(null)

  React.useEffect(() => {
    if (state.status === 'authenticated') setForceView(null)
  }, [state.status])

  // Landing page at root — always accessible
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

  // Dashboard — requires auth + paid plan
  if (location.pathname.startsWith('/dashboard')) {
    if (state.status === 'unauthenticated') {
      if (forceView === 'login') {
        return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView(null)} />
      }
      return <SetupForm onSubmit={register} error={registerError} isPending={registerPending} onBack={() => navigate('/')} onSwitchToLogin={() => setForceView('login')} />
    }
    if (!localStorage.getItem('sandwich_paid_plan')) {
      navigate('/checkout', { replace: true })
      return null
    }
    const username = state.status === 'authenticated' ? state.username : ''
    return <App username={username} onLogout={() => { void logout(); navigate('/') }} />
  }

  // Checkout — unauthenticated: register first (default), login on request
  // Authenticated: render App so CheckoutPage renders (plan picker → payment)
  if (location.pathname.startsWith('/checkout')) {
    if (state.status === 'unauthenticated') {
      if (forceView === 'login') {
        return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView(null)} />
      }
      return <SetupForm onSubmit={register} error={registerError} isPending={registerPending} onBack={() => navigate('/')} onSwitchToLogin={() => setForceView('login')} />
    }
    const username = state.status === 'authenticated' ? state.username : ''
    return <App username={username} onLogout={() => { void logout(); navigate('/') }} />
  }

  // Fallback
  if (state.status === 'unauthenticated') {
    return (
      <LoginForm
        onSubmit={login}
        error={loginError}
        isPending={loginPending}
        onBack={() => navigate('/')}
        onSwitchToRegister={() => setForceView(null)}
      />
    )
  }

  const username = state.status === 'authenticated' ? state.username : ''
  return <App username={username} onLogout={logout} />
}
