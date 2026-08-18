import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useSubscription } from './hooks/useSubscription'
import { identifyPostHog } from './lib/posthog'
import PrivateRoute from './components/PrivateRoute'
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import VerifyEmailPage from './components/VerifyEmailPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import Dashboard from './components/Dashboard'
import PaymentPage from './components/PaymentPage'
import PaymentReturn from './components/PaymentReturn'
import SharePage from './components/SharePage'

function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return <Dashboard onBack={() => { void logout(); navigate('/') }} />
}

export default function App() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const { data: sub, isLoading: subLoading } = useSubscription()

  const authUserId = state.status === 'authenticated' ? state.id : ''
  const authUsername = state.status === 'authenticated' ? state.username : ''

  // PostHog identify — runs once we know who the user is and their plan
  React.useEffect(() => {
    if (state.status === 'authenticated' && !subLoading) {
      identifyPostHog(authUserId, { username: authUsername, plan: sub?.planSlug ?? null })
    }
  }, [state.status, authUserId, authUsername, sub?.planSlug, subLoading])

  // Honor a pending plan chosen at signup
  React.useEffect(() => {
    if (state.status === 'authenticated') {
      const pending = localStorage.getItem('sandwich_pending_plan')
      if (pending === 'pro') {
        localStorage.removeItem('sandwich_pending_plan')
        navigate('/checkout?plan=pro', { replace: true })
      }
    }
  }, [state.status, navigate])

  return (
    <Routes>
      <Route path="/" element={
        <LandingPage
          onGoToApp={(plan) => {
            if (plan) navigate(`/register?plan=${plan}`)
            else navigate('/register')
          }}
        />
      } />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage onBack={() => navigate('/')} />} />
      <Route path="/reset-password" element={<ResetPasswordPage onBack={() => navigate('/')} />} />
      <Route path="/share/:token" element={<SharePage />} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/checkout" element={<PrivateRoute><PaymentPage /></PrivateRoute>} />
      <Route path="/checkout/return" element={<PrivateRoute><PaymentReturn /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
