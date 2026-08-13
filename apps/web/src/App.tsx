import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import CheckoutPage from './components/CheckoutPage'
import PaymentReturn from './components/PaymentReturn'
import PrototypeView from './components/PrototypeView'
import SharePage from './components/SharePage'
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
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/return" element={<PaymentReturn />} />
      <Route path="/prototype" element={<PrototypeView />} />
      <Route path="/share/:token" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
