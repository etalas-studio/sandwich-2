import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'
import LoginForm from './LoginForm'
import App from '../App'

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

  if (isLoading) {
    return <div className="ds-bg min-h-screen" />
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

  // TypeScript can't narrow state to 'authenticated' here even though we
  // already handled isLoading and the other statuses above.
  const username = state.status === 'authenticated' ? state.username : ''
  return <App username={username} onLogout={logout} />
}
