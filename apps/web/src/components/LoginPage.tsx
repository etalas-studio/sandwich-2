import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoginForm from './LoginForm'

export default function LoginPage() {
  const { state, login, loginError, loginPending } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (state.status === 'authenticated') navigate('/dashboard', { replace: true })
  }, [state.status, navigate])

  return (
    <LoginForm
      onSubmit={async (username, password) => {
        try {
          await login(username, password)
        } catch {
          // loginError from useAuth surfaces the error to the form
        }
      }}
      error={loginError}
      isPending={loginPending}
      onBack={() => navigate('/')}
      onSwitchToRegister={() => navigate('/register')}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  )
}
