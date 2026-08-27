import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'

export default function RegisterPage() {
  const { state, register, login, registerError, registerPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'authenticated') router.push('/dashboard')
  }, [state.status, router])

  return (
    <SetupForm
      onSubmit={register}
      login={login}
      error={registerError}
      isPending={registerPending}
      onBack={() => router.push('/')}
      onSwitchToLogin={() => router.push('/login')}
    />
  )
}
