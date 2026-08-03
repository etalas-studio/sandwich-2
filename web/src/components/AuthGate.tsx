import { useAuth } from '../useAuth'
import SetupForm from './SetupForm'
import LoginForm from './LoginForm'
import App from '../App'

export default function AuthGate() {
  const { state, register, login, logout } = useAuth()

  if (state.status === 'loading') {
    return <div className="ds-bg min-h-screen" />
  }

  if (state.status === 'setup_required') {
    return <SetupForm onSubmit={register} />
  }

  if (state.status === 'unauthenticated') {
    return <LoginForm onSubmit={login} />
  }

  return <App username={state.username} onLogout={logout} />
}
