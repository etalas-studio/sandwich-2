import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import LoginForm from './LoginForm'

export default function LoginPage() {
  const { state, login, loginError, loginPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'authenticated') router.push('/dashboard')
  }, [state.status, router])

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
      onBack={() => router.push('/')}
      onSwitchToRegister={() => router.push('/register')}
      onForgotPassword={() => router.push('/forgot-password')}
    />
  )
}
