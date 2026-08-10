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
  const [forceView, setForceView] = React.useState<'login' | 'register' | null>(null)

  if (isLoading) {
    return <div className="ds-bg min-h-screen" />
  }

  // Landing page at root — always accessible
  if (location.pathname === '/') {
    return (
      <LandingPage
        onGoToApp={(plan) => navigate(plan ? `/checkout?plan=${plan}` : '/checkout')}
      />
    )
  }

  const showRegister = forceView === 'register'

  // Dashboard — requires login, then a completed checkout
  if (location.pathname.startsWith('/dashboard')) {
    if (showRegister) {
      return <SetupForm onSubmit={register} error={registerError} isPending={registerPending} onBack={() => navigate('/')} onSwitchToLogin={() => setForceView('login')} />
    }
    if (state.status === 'unauthenticated') {
      return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView('register')} />
    }
    if (!localStorage.getItem('sandwich_paid_plan')) {
      navigate('/checkout', { replace: true })
      return null
    }
    const username = state.status === 'authenticated' ? state.username : ''
    return <App username={username} onLogout={() => { void logout(); navigate('/') }} />
  }

  if (showRegister) {
    return (
      <SetupForm
        onSubmit={register}
        error={registerError}
        isPending={registerPending}
        onBack={() => navigate('/')}
        onSwitchToLogin={() => setForceView('login')}
      />
    )
  }

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
