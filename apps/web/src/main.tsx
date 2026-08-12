import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthGate from './components/AuthGate'
import { LanguageProvider } from './lib/i18n'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
          <BrowserRouter>
            <AuthGate />
          </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
)
