# Auth Flow Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `AuthGate` if/else router with real routes for `/login` and `/register`, a thin `<PrivateRoute>` guard, and Snap-as-modal for all payment triggers.

**Architecture:** `App.tsx` owns all route declarations. `AuthGate.tsx` is deleted and replaced by a `<PrivateRoute>` component. `LoginForm` and `SetupForm` are wrapped in page components (`LoginPage`, `RegisterPage`) that use `useNavigate` instead of prop callbacks. `CheckoutPage`'s `PlanPicker` is deleted; `PaymentTrigger` is extracted to `PaymentPage`. Dashboard handles the pending-plan Snap trigger on mount.

**Tech Stack:** React 18, React Router v6, `@tanstack/react-query`, Vitest + `@testing-library/react`

## Global Constraints

- No new npm dependencies
- No backend changes — all changes are frontend only (`apps/web/src`)
- Existing `useAuth`, `useSubscription` hook APIs must not change
- Existing `LoginForm` and `SetupForm` component UI must not change — only their prop wiring changes
- All existing tests must continue to pass
- Branch: `refactor/auth-flow`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/components/PrivateRoute.tsx` | Redirects unauthenticated users to `/login` |
| Create | `src/components/LoginPage.tsx` | Wraps `LoginForm`, wires navigate callbacks |
| Create | `src/components/RegisterPage.tsx` | Wraps `SetupForm`, wires navigate callbacks |
| Modify | `src/App.tsx` | Owns all routes, replaces thin wrapper |
| Modify | `src/components/VerifyEmailPage.tsx` | On success → `/login` instead of `/` |
| Modify | `src/components/Dashboard.tsx` | On mount: read + clear `sandwich_pending_plan`, fire Snap |
| Modify | `src/components/CheckoutPage.tsx` → rename `PaymentPage.tsx` | Remove `PlanPicker`; keep `PaymentTrigger` + success/error |
| Delete | `src/components/AuthGate.tsx` | Replaced by `PrivateRoute` + `App.tsx` routes |

---

### Task 1: Create `<PrivateRoute>`

**Files:**
- Create: `apps/web/src/components/PrivateRoute.tsx`
- Create: `apps/web/src/components/PrivateRoute.test.tsx`

**Interfaces:**
- Produces: `export default function PrivateRoute({ children }: { children: ReactNode }): JSX.Element`
- Consumes: `useAuth()` from `../hooks/useAuth` — reads `state.status` and `isLoading`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/PrivateRoute.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import * as useAuthModule from '../hooks/useAuth'

function setup(status: 'authenticated' | 'unauthenticated' | 'loading') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    state: status === 'authenticated'
      ? { status: 'authenticated', id: 'u1', username: 'alice' }
      : { status: 'unauthenticated' },
    isLoading: status === 'loading',
    login: vi.fn(), loginError: null, loginPending: false,
    register: vi.fn(), registerError: null, registerPending: false,
    logout: vi.fn(),
  })
}

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    setup('authenticated')
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('protected')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    setup('unauthenticated')
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('renders nothing (blank) while loading', () => {
    setup('loading')
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<PrivateRoute><div>protected</div></PrivateRoute>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(container.firstChild).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run src/components/PrivateRoute.test.tsx
```
Expected: FAIL — `PrivateRoute` not found.

- [ ] **Step 3: Implement `PrivateRoute`**

```tsx
// apps/web/src/components/PrivateRoute.tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { state, isLoading } = useAuth()
  if (isLoading) return <div className="ds-bg min-h-screen" />
  if (state.status === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run src/components/PrivateRoute.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PrivateRoute.tsx apps/web/src/components/PrivateRoute.test.tsx
git commit -m "feat(auth): add PrivateRoute guard"
```

---

### Task 2: Create `LoginPage`

**Files:**
- Create: `apps/web/src/components/LoginPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` — `login`, `loginError`, `loginPending`
- Consumes: `LoginForm` from `./LoginForm` — props: `onSubmit`, `error`, `isPending`, `onBack`, `onSwitchToRegister`, `onForgotPassword`
- Produces: `export default function LoginPage(): JSX.Element` — no props

- [ ] **Step 1: Implement `LoginPage`**

No new logic here — just wires `useAuth` and `useNavigate` into `LoginForm`'s props.

```tsx
// apps/web/src/components/LoginPage.tsx
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
        await login(username, password)
        navigate('/dashboard', { replace: true })
      }}
      error={loginError}
      isPending={loginPending}
      onBack={() => navigate('/')}
      onSwitchToRegister={() => navigate('/register')}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/LoginPage.tsx
git commit -m "feat(auth): add LoginPage route component"
```

---

### Task 3: Create `RegisterPage`

**Files:**
- Create: `apps/web/src/components/RegisterPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` — `register`, `registerError`, `registerPending`
- Consumes: `SetupForm` from `./SetupForm` — props: `onSubmit`, `error`, `isPending`, `onBack`, `onSwitchToLogin`
- Produces: `export default function RegisterPage(): JSX.Element` — no props

Note: `SetupForm` already reads `?plan=pro` from the URL via `useSearchParams` and sets `localStorage.sandwich_pending_plan` on successful submit. `RegisterPage` does not need to duplicate that logic.

- [ ] **Step 1: Implement `RegisterPage`**

```tsx
// apps/web/src/components/RegisterPage.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/RegisterPage.tsx
git commit -m "feat(auth): add RegisterPage route component"
```

---

### Task 4: Fix `VerifyEmailPage` — redirect to `/login` on success

**Files:**
- Modify: `apps/web/src/components/VerifyEmailPage.tsx:31`

**Interfaces:**
- No interface changes.

- [ ] **Step 1: Change the success button to redirect to `/login`**

Find this block (around line 30):
```tsx
{state === 'success' && (
  <div className="flex flex-col gap-4">
    <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('verify_success')}</p>
    <button onClick={() => navigate('/')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
  </div>
)}
```

Change `navigate('/')` to `navigate('/login')`:
```tsx
{state === 'success' && (
  <div className="flex flex-col gap-4">
    <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('verify_success')}</p>
    <button onClick={() => navigate('/login')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/VerifyEmailPage.tsx
git commit -m "fix(auth): verify email success redirects to /login"
```

---

### Task 5: Fix `Dashboard` — handle `sandwich_pending_plan` safely

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**
- No interface changes. Snap is loaded globally from `window.snap` (already set up by `PaymentTrigger`'s script injection pattern).

The current `sandwich_pending_plan` handling in `AuthGate` (lines 40-48) only clears the key on success. We need to: read on mount, clear immediately, fire Snap, clear again on error/close.

- [ ] **Step 1: Find the top of the `Dashboard` default export and the existing `useEffect` blocks**

In `apps/web/src/components/Dashboard.tsx`, find the main exported component (not the sub-components). It currently has no `sandwich_pending_plan` handling — that lived in `AuthGate`.

- [ ] **Step 2: Add the pending plan effect**

Add this import at the top of the file if not already present:
```tsx
import { useQueryClient } from '@tanstack/react-query'
```

Add this effect inside the main `Dashboard` component, after existing state declarations:

```tsx
// Fire Snap for a pending Pro upgrade set during registration
const queryClient = useQueryClient()
useEffect(() => {
  const pending = localStorage.getItem('sandwich_pending_plan')
  if (pending !== 'pro') return
  localStorage.removeItem('sandwich_pending_plan') // clear immediately — don't loop

  const fireSnap = async () => {
    try {
      const txRes = await fetch(apiUrl('/api/midtrans/transaction'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planSlug: 'pro' }),
      })
      if (!txRes.ok) return
      const data = await txRes.json() as {
        token: string | null
        simulated: boolean
        clientKey: string
        isProduction: boolean
      }
      if (data.simulated || !data.token) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        return
      }
      await new Promise<void>((resolve, reject) => {
        const w = window as unknown as Record<string, unknown>
        if (w.snap) { resolve(); return }
        const script = document.createElement('script')
        script.src = data.isProduction
          ? 'https://app.midtrans.com/snap/snap.js'
          : 'https://app.sandbox.midtrans.com/snap/snap.js'
        script.setAttribute('data-client-key', data.clientKey)
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Snap.js failed to load'))
        document.head.appendChild(script)
      })
      ;(window as unknown as { snap: { pay: (token: string, opts: Record<string, unknown>) => void } }).snap.pay(data.token, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription'] }) },
        onPending: () => { /* user can check status later */ },
        onError: () => { /* Snap already shows error UI */ },
        onClose: () => { /* user closed — no action needed, key already cleared */ },
      })
    } catch {
      /* transient — key already cleared, user can upgrade manually */
    }
  }

  void fireSnap()
}, [queryClient])
```

Also add `apiUrl` import if not already present:
```tsx
import { apiUrl } from '../api/base'
```

- [ ] **Step 3: Add no-subscription error state**

In the same `Dashboard` component, find where subscription is checked. Add an error state for null subscription. Find the `useSubscription` usage and add after it:

```tsx
const { data: sub } = useSubscription()

if (!sub?.planSlug) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4EBE1' }}>
      <div className="text-center max-w-sm px-4">
        <p className="text-sm text-zinc-500 mb-4">No active plan found. Please contact support.</p>
        <a href="mailto:support@etalas.ai" className="text-sm font-semibold underline" style={{ color: '#f91814' }}>
          support@etalas.ai
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx
git commit -m "feat(auth): handle pending plan Snap trigger on dashboard mount"
```

---

### Task 6: Strip `PlanPicker` from `CheckoutPage`, rename to `PaymentPage`

**Files:**
- Rename + Modify: `apps/web/src/components/CheckoutPage.tsx` → `apps/web/src/components/PaymentPage.tsx`

`CheckoutPage` currently exports `CheckoutPage` as default. After this task it exports `PaymentPage` which only contains `PaymentTrigger` + its success/error states. `PlanPicker` and the `if (!paramPlan)` branch are deleted.

- [ ] **Step 1: Create `PaymentPage.tsx` from `CheckoutPage.tsx`**

Copy the file and strip everything except `PaymentTrigger`, its success state, and its error state. Remove the `PlanPicker` function entirely. Remove the `if (!paramPlan)` early return. The new file renders `PaymentTrigger` directly given a `plan` and `planSlug` from URL params — if no `plan` param, redirect to `/`:

```tsx
// apps/web/src/components/PaymentPage.tsx
import React, { useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../lib/i18n'
import { apiUrl } from '../api/base'
import { verifyPayment } from '../api/payments'
import { useSubscription } from '../hooks/useSubscription'
import { getPlanMeta } from '../lib/plans'
import { trackPostHog } from '../lib/posthog'

const bowlby = "'Bowlby One', system-ui"

export default function PaymentPage() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramPlan = searchParams.get('plan')
  const expired = searchParams.get('expired') === '1'
  const { data: sub } = useSubscription()

  if (!paramPlan) return <Navigate to="/" replace />

  const planSlug = paramPlan
  const plan = getPlanMeta(planSlug) ?? getPlanMeta('starter')!

  const notice = expired
    ? tr('checkout_expired_banner')
    : sub?.planSlug
      ? tr('checkout_current_plan').replace('{plan}', sub.planSlug)
      : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }}>
      {notice && (
        <div className="w-full text-center px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
          {notice}
        </div>
      )}
      <PaymentTrigger planSlug={planSlug} plan={plan} tr={tr} navigate={navigate} />
    </div>
  )
}

function PaymentTrigger({
  planSlug,
  plan,
  tr,
  navigate,
}: {
  planSlug: string
  plan: { name: string; amount: number }
  tr: ReturnType<typeof useLanguage>['t']
  navigate: ReturnType<typeof useNavigate>
}) {
  const queryClient = useQueryClient()
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waitForActivePlan = async (): Promise<boolean> => {
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(apiUrl('/api/subscriptions/active'), { credentials: 'include' })
        if (res.ok) {
          const s = await res.json() as { planSlug: string | null }
          if (s.planSlug) return true
        }
      } catch { /* transient */ }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return false
  }

  const hasTriggered = React.useRef(false)
  React.useEffect(() => {
    if (hasTriggered.current) return
    hasTriggered.current = true

    const run = async () => {
      if (plan.amount === 0) {
        try {
          await fetch(apiUrl('/api/midtrans/transaction'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ planSlug }),
          })
        } catch { /* Starter already active */ }
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        trackPostHog('subscription_activated', { plan_slug: planSlug, free: true })
        navigate('/dashboard', { replace: true })
        return
      }

      trackPostHog('checkout_started', { plan_slug: planSlug })

      let txRes: Response
      try {
        txRes = await fetch(apiUrl('/api/midtrans/transaction'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ planSlug }),
        })
      } catch {
        setError(tr('checkout_payment_error'))
        return
      }

      if (!txRes.ok) {
        setError(tr('checkout_payment_error'))
        return
      }

      const data = await txRes.json() as {
        token: string | null
        simulated: boolean
        orderId: string
        clientKey: string
        isProduction: boolean
      }

      if (data.simulated || !data.token) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        setIsDone(true)
        return
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const w = window as unknown as Record<string, unknown>
          if (w.snap) { resolve(); return }
          const script = document.createElement('script')
          script.src = data.isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js'
          script.setAttribute('data-client-key', data.clientKey)
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Snap.js failed to load'))
          document.head.appendChild(script)
        })
      } catch {
        setError(tr('checkout_payment_error'))
        return
      }

      ;(window as unknown as { snap: { pay: (token: string, opts: Record<string, unknown>) => void } }).snap.pay(data.token, {
        onSuccess: () => {
          void (async () => {
            try { await verifyPayment(data.orderId) } catch { /* ignore */ }
            await waitForActivePlan()
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            trackPostHog('payment_succeeded', { plan_slug: planSlug, order_id: data.orderId })
            trackPostHog('subscription_activated', { plan_slug: planSlug })
            setIsDone(true)
          })()
        },
        onPending: () => { navigate(`/checkout/return?order_id=${data.orderId}&transaction_status=pending`) },
        onError: () => { trackPostHog('payment_failed', { plan_slug: planSlug }); setError(tr('checkout_payment_error')) },
        onClose: () => { navigate('/dashboard') },
      })
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isDone) {
    return (
      <div className="min-h-screen flex items-center justify-center antialiased" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:check-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl tracking-tight mb-2" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('checkout_success_title')}</h1>
          <p className="text-sm text-zinc-500 mb-8">{plan.name} {tr('checkout_plan_active')} {tr('checkout_success_note')}</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: '#111827' }}>
            {tr('checkout_success_cta')}
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center antialiased px-4" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f91814' }}>
              <iconify-icon icon="solar:danger-circle-bold" width="28" className="text-white" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: '#111827' }}>
            {tr('auth_back')}
          </button>
        </div>
      </div>
    )
  }

  return <div className="min-h-screen" style={{ backgroundColor: '#F4EBE1' }} />
}
```

- [ ] **Step 2: Delete `CheckoutPage.tsx`**

```bash
rm apps/web/src/components/CheckoutPage.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/PaymentPage.tsx
git add -u apps/web/src/components/CheckoutPage.tsx
git commit -m "refactor(checkout): extract PaymentPage, delete PlanPicker"
```

---

### Task 7: Rewrite `App.tsx` with full route declarations

**Files:**
- Modify: `apps/web/src/App.tsx`

This task wires all previous tasks together and deletes `AuthGate`.

- [ ] **Step 1: Rewrite `App.tsx`**

```tsx
// apps/web/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
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
  return <Dashboard onBack={() => navigate('/')} onLogout={() => { void logout(); navigate('/') }} />
}

export default function App() {
  const navigate = useNavigate()

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
```

- [ ] **Step 2: Update `main.tsx` to remove `AuthGate`**

In `apps/web/src/main.tsx`, replace `import AuthGate` with `import App` and render `<App />` directly:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LanguageProvider } from "./lib/i18n";
import { initPostHog } from "./lib/posthog";
import "@fontsource-variable/geist";
import "./index.css";

initPostHog();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 3: Delete `AuthGate.tsx`**

```bash
rm apps/web/src/components/AuthGate.tsx
```

- [ ] **Step 4: Check `Dashboard` props — add `onLogout` if missing**

`Dashboard` currently receives `onBack` from `App.tsx`. Check if it accepts `onLogout`. If it's wired internally via `AccountSection`, remove from props. If it expects `onLogout` prop, the `DashboardPage` wrapper above already passes it.

```bash
grep -n "onLogout\|onBack" apps/web/src/components/Dashboard.tsx | head -10
```

Adjust the `DashboardPage` wrapper in `App.tsx` to match the actual `Dashboard` prop interface.

- [ ] **Step 5: Run all tests**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass. Fix any import errors from deleted `AuthGate` or renamed `CheckoutPage`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/main.tsx
git add -u apps/web/src/components/AuthGate.tsx
git commit -m "refactor(auth): replace AuthGate with real routes in App.tsx"
```

---

### Task 8: Update `LandingPage` login button

**Files:**
- Modify: `apps/web/src/components/LandingPage.tsx`

The login button currently calls `navigate('/login')` — this is already correct from our earlier PR. The "Get Started" CTA needs to call `onGoToApp()` (already does). The "Get Pro" CTA needs to call `onGoToApp('pro')` — check that pricing section CTAs pass the plan slug correctly.

- [ ] **Step 1: Verify CTA wiring**

```bash
grep -n "onGoToApp\|plan=pro\|plan_slug" apps/web/src/components/LandingPage.tsx | head -20
```

- [ ] **Step 2: Ensure Pro CTA passes `'pro'` to `onGoToApp`**

Find the Pro plan CTA button in the pricing section. It should call `onGoToApp('pro')`. If it calls `onGoToApp()` without a plan or uses a raw `navigate`, update to `onGoToApp(plan.slug)` — which `App.tsx` now routes to `/register?plan=pro`.

- [ ] **Step 3: Run the app manually and test all three nav paths**

```bash
cd apps/web && npm run dev
```

Test:
1. Click "Login" → lands on `/login` ✓
2. Click "Get Started" → lands on `/register` ✓  
3. Click "Get Pro" in pricing → lands on `/register?plan=pro`, plan toggle shows Pro selected ✓

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/LandingPage.tsx
git commit -m "fix(landing): wire Pro CTA to /register?plan=pro"
```

---

### Task 9: Final integration test + push

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Manual smoke test — full signup flow**

Start dev server: `cd apps/web && npm run dev`

Verify:
1. `/` — landing renders, Login and Get Started buttons work
2. `/register` — register form shows, Starter selected by default
3. `/register?plan=pro` — register form shows, Pro selected by default
4. After submit — "check your email" screen shown
5. `/login` — login form shows, forgot password link works
6. `/dashboard` without auth — redirects to `/login`
7. `/checkout` without auth — redirects to `/login`
8. After login — dashboard loads, no redirect loop

- [ ] **Step 3: Push and open PR**

```bash
git push origin refactor/auth-flow
gh pr create --title "refactor(auth): proper routes for login/register, remove AuthGate" \
  --body "Replaces monolithic AuthGate if/else routing with real React Router routes.

## Changes
- Add \`/login\` and \`/register\` as proper routes
- Replace \`AuthGate\` with thin \`<PrivateRoute>\` guard
- Delete \`CheckoutPage\`'s \`PlanPicker\` (landing page covers it)
- Rename \`CheckoutPage\` → \`PaymentPage\`
- Dashboard handles pending Pro Snap trigger on mount
- \`VerifyEmailPage\` redirects to \`/login\` on success

## Test plan
- [ ] All vitest tests pass
- [ ] Full signup flow (starter + pro intent) works end to end
- [ ] Login/logout/redirect guards work correctly
- [ ] No regression on forgot password, reset password, share page"
```
