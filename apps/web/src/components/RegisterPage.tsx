import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SetupForm from './SetupForm'

export default function RegisterPage() {
  const { state, register, registerError, registerPending } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (state.status === 'authenticated') navigate('/dashboard', { replace: true })
  }, [state.status, navigate])

  return (
    <SetupForm
      onSubmit={register}
      error={registerError}
      isPending={registerPending}
      onBack={() => navigate('/')}
      onSwitchToLogin={() => navigate('/login')}
    />
  )
}
