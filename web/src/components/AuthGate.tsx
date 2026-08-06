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

  if (isLoading) {
    return <div className="ds-bg min-h-screen" />
  }

  // Landing page at root — always accessible
  if (location.pathname === '/') {
    return <LandingPage onGoToApp={() => navigate('/dashboard')} />
  }

  // Dashboard — skip auth entirely
  if (location.pathname.startsWith('/dashboard')) {
    const username = state.status === 'authenticated' ? state.username : 'guest'
    return <App username={username} onLogout={() => navigate('/')} />
  }

  if (state.status === 'setup_required') {
    return (
      <SetupForm
        onSubmit={register}
        error={registerError}
        isPending={registerPending}
      />
    )
  }

  if (state.status === 'unauthenticated') {
    return (
      <LoginForm
        onSubmit={login}
        error={loginError}
        isPending={loginPending}
      />
    )
  }

  const username = state.status === 'authenticated' ? state.username : ''
  return <App username={username} onLogout={logout} />
}
