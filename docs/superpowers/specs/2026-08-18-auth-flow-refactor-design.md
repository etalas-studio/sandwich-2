# Auth Flow Refactor — Design Spec
**Date:** 2026-08-18  
**Status:** Approved

---

## Problem

The current auth flow is vibe-coded into a single `AuthGate` component that renders `LoginForm`, `SetupForm`, `LandingPage`, and `App` via a giant if/else chain. `/checkout` doubles as a plan picker and a payment trigger. There are no real routes for login or register — URL does not reflect app state, back-button is broken in auth flows, and adding new routes requires surgery on `AuthGate`.

---

## Goals

- `/login` and `/register` are real, navigable routes
- `AuthGate` is replaced by a thin `<PrivateRoute>` guard
- `/checkout` is deleted as a plan picker; `LandingPage` pricing section already covers it
- Payment (Midtrans Snap) fires as a modal — no page navigation required
- Every user flow is expressible as a URL

---

## Routes

| Route | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/login` | `LoginPage` | Unauthenticated only — redirect to `/dashboard` if already authed |
| `/register` | `RegisterPage` | Unauthenticated only — redirect to `/dashboard` if already authed |
| `/register?plan=pro` | `RegisterPage` | Same as above; stores plan intent |
| `/verify-email?token=` | `VerifyEmailPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/reset-password?token=` | `ResetPasswordPage` | Public |
| `/dashboard` | `Dashboard` | `<PrivateRoute>` — redirect to `/login` if unauthenticated |
| `/checkout/return` | `PaymentReturn` | `<PrivateRoute>` |
| `/share/:token` | `SharePage` | Public |

`/checkout` (plan picker) is deleted.

---

## Components

### `<PrivateRoute>`
Replaces `AuthGate`. Single responsibility: if `useAuth()` returns `unauthenticated`, redirect to `/login`. Otherwise render children. ~20 lines.

### `LoginPage`
- Renders `LoginForm` (existing component, no logic change)
- On success → `navigate('/dashboard')`
- Has link to `/register` and `/forgot-password`
- If already authenticated → redirect to `/dashboard`

### `RegisterPage`
- Renders `SetupForm` (existing component, no logic change)
- Reads `?plan=pro` from query string; if present, stores `spectr_pending_plan = 'pro'` in localStorage before submit
- On success → show "check your email" state (no redirect yet)
- Has link to `/login`
- If already authenticated → redirect to `/dashboard`

### `VerifyEmailPage` (existing — small fix)
- On success: redirect to `/login` instead of `/`
- No other changes

### `Dashboard` (existing — small fix)
- On mount: read `spectr_pending_plan` from localStorage
- If `'pro'`: clear it immediately, then fire Snap modal
- Clear the key on Snap success, error, and close — not just success
- If user has no subscription (DB edge case): show error state with support link, no redirect loop

### `PaymentPage` (rename from `CheckoutPage`)
- Strips out `PlanPicker` entirely — that component is deleted
- Retains `PaymentTrigger` + success/error states
- Used internally when Snap fires (not a user-navigable page directly)
- `/checkout/return` still uses `PaymentReturn` unchanged

### `App.tsx`
Owns all route declarations. Expands from thin wrapper to the actual router:

```tsx
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/verify-email" element={<VerifyEmailPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />
  <Route path="/share/:token" element={<SharePage />} />
  <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
  <Route path="/checkout/return" element={<PrivateRoute><PaymentReturn /></PrivateRoute>} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

---

## User Flows

### Default signup
```
/ → /register → [email sent] → /verify-email?token=... → /login → /dashboard
```

### Pro signup (from landing page CTA)
```
/ → /register?plan=pro → [stores spectr_pending_plan='pro'] → [email sent]
  → /verify-email?token=... → /login → /dashboard → [Snap fires automatically]
  → [payment success] → stays on /dashboard
```

### Login (returning user)
```
/login → /dashboard
```

### Upgrade from dashboard
```
/dashboard → [click Upgrade to Pro] → Snap modal fires inline → payment → stays on /dashboard
```

### No subscription edge case
```
/dashboard → [useSubscription returns null] → error state shown inline, support link
```

---

## What Gets Deleted

- `AuthGate.tsx` — replaced by `<PrivateRoute>`
- `CheckoutPage.tsx` `PlanPicker` component — deleted
- `forceView` state (`'login' | null`) in AuthGate — deleted
- `/checkout` route (plan picker) — deleted; landing page pricing section covers it

## What Gets Renamed

- `CheckoutPage.tsx` → `PaymentPage.tsx`
- `SetupForm.tsx` → `RegisterPage.tsx` (or wrap inside new `RegisterPage`)
- `LoginForm.tsx` → `LoginPage.tsx` (or wrap inside new `LoginPage`)

---

## What Does NOT Change

- All auth API calls (`useAuth`, `useSubscription`, `postLogin`, `postRegister`, etc.)
- Backend routes — no server changes required
- `PaymentReturn` component
- `ForgotPasswordPage`, `ResetPasswordPage` (already work correctly)
- Midtrans Snap integration logic

---

## Out of Scope

- Fixing P0 security issues from the audit (separate work)
- Any UI/visual redesign of login or register pages
- Email template changes
