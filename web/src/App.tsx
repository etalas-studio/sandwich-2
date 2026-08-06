import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import { useNavigate } from 'react-router-dom'

interface AppProps {
  username: string
  onLogout: () => void
}

function DashboardPage() {
  const navigate = useNavigate()
  return <Dashboard onBack={() => navigate('/')} />
}

export default function App(_props: AppProps) {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
