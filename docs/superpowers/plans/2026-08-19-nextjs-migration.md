# Next.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web` Vite SPA with Next.js App Router so the landing page is statically generated and SEO-complete, while all auth/dashboard pages remain `'use client'` and move over unchanged.

**Architecture:** App Router under `src/app/`. Landing page (`src/app/page.tsx`) is a server component that exports `metadata` and renders `<LandingPage>` (which gets `'use client'`). All other pages are thin `'use client'` wrappers around existing components. `react-router-dom` is deleted; navigation moves to `next/navigation`. Two effects from `App.tsx` move into a new `AppEffects.tsx` client component in the root layout.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4 (`@tailwindcss/postcss`), `@tanstack/react-query` 5, TypeScript 5, Vitest (tests unchanged)

**Spec:** `docs/superpowers/specs/2026-08-19-nextjs-migration-design.md`

## Global Constraints

- Node ≥ 22 (from root `engines`)
- React 19 — do not downgrade
- Tailwind CSS 4 via `@tailwindcss/postcss` — no config file, no `tailwind.config.js`
- All existing component files live under `src/components/`, `src/hooks/`, `src/lib/`, `src/api/` — paths do not change
- PostHog env vars: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (replacing `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`)
- No backend changes
- Branch: `feat/nextjs-migration`

---

## File Map

**Created:**
- `apps/web/src/app/layout.tsx` — root layout, providers, fonts, AppEffects
- `apps/web/src/app/page.tsx` — server component, metadata, JSON-LD, renders LandingPage
- `apps/web/src/app/dashboard/page.tsx` — protected page wrapper
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/register/page.tsx`
- `apps/web/src/app/verify-email/page.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/reset-password/[token]/page.tsx`
- `apps/web/src/app/pay/page.tsx`
- `apps/web/src/app/pay/return/page.tsx`
- `apps/web/src/app/share/[id]/page.tsx`
- `apps/web/src/components/AppEffects.tsx` — PostHog identify + pending plan redirect
- `apps/web/next.config.ts`
- `apps/web/public/robots.txt`
- `apps/web/public/sitemap.xml`

**Modified:**
- `apps/web/package.json` — swap Vite → Next.js, remove react-router-dom
- `apps/web/src/index.css` — rename to `src/app/globals.css` (Next.js convention)
- `apps/web/src/components/LandingPage.tsx` — add `'use client'`, replace `useNavigate` with `useRouter`, remove `onGoToApp` prop
- `apps/web/src/components/LoginPage.tsx` — replace `useNavigate` with `useRouter`
- `apps/web/src/components/RegisterPage.tsx` — replace `useNavigate` with `useRouter`
- `apps/web/src/components/ResetPasswordPage.tsx` — replace `useNavigate`/`useSearchParams` with Next.js equivalents, remove `onBack` prop
- `apps/web/src/components/ForgotPasswordPage.tsx` — remove `onBack` prop (page handles its own back nav)
- `apps/web/src/components/PaymentPage.tsx` — replace `useNavigate`/`useSearchParams`/`Navigate` with Next.js equivalents
- `apps/web/src/components/PaymentReturn.tsx` — replace `useNavigate`/`useSearchParams`
- `apps/web/src/components/SharePage.tsx` — replace `useParams` with `use(params)` or prop
- `apps/web/src/lib/posthog.ts` — replace `import.meta.env.VITE_*` with `process.env.NEXT_PUBLIC_*`
- `apps/web/tsconfig.json` (or create) — Next.js TypeScript config
- Root `vercel.json` — remove SPA rewrite

**Deleted:**
- `apps/web/src/App.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/vite-env.d.ts`
- `apps/web/src/components/PrivateRoute.tsx`
- `apps/web/index.html`
- `apps/web/vite.config.ts`

---

### Task 1: Swap dependencies and config files

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Delete: `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/vite-env.d.ts`

**Interfaces:**
- Produces: `next dev` and `next build` commands available; TypeScript resolves `@/*` paths

- [ ] **Step 1: Update `apps/web/package.json`**

Replace the entire file contents:

```json
{
  "name": "web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.6.0",
    "@fontsource-variable/geist": "^5.3.0",
    "@tanstack/react-query": "^5.101.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.28.0",
    "marked": "^18.0.7",
    "next": "^15.0.0",
    "posthog-js": "^1.417.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "shadcn": "^4.16.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "autoprefixer": "^10.5.4",
    "jsdom": "^30.0.1",
    "postcss": "^8.5.25",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.6.3",
    "vitest": "^4.1.10"
  }
}
```

Note: `react-router-dom`, `vite`, `@vitejs/plugin-react` are gone. `next` added. TypeScript pinned to `^5.6.3` (was `^7.0.0` — Next.js 15 requires TS 5.x).

- [ ] **Step 2: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {}

export default config
```

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Delete Vite artefacts**

```bash
rm apps/web/vite.config.ts apps/web/index.html apps/web/src/vite-env.d.ts
```

- [ ] **Step 5: Install dependencies**

```bash
npm --prefix apps/web install
```

- [ ] **Step 6: Update root `vercel.json`**

Replace the SPA rewrite with an empty object — Vercel auto-detects Next.js:

```json
{}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts apps/web/tsconfig.json vercel.json
git commit -m "chore: swap Vite for Next.js, remove react-router-dom"
```

---

### Task 2: Fix PostHog env vars

`import.meta.env.VITE_*` does not exist in Next.js. Replace with `process.env.NEXT_PUBLIC_*`.

**Files:**
- Modify: `apps/web/src/lib/posthog.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `initPostHog()`, `identifyPostHog()`, `trackPostHog()` — same signatures, now use Next.js env vars

- [ ] **Step 1: Replace env var references in `posthog.ts`**

Open `apps/web/src/lib/posthog.ts`. Change:

```ts
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined
```

To:

```ts
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST
```

- [ ] **Step 2: Update `.env.example` if it exists**

```bash
grep -l "VITE_POSTHOG" apps/web/.env* 2>/dev/null || echo "none"
```

If found, rename `VITE_POSTHOG_KEY` → `NEXT_PUBLIC_POSTHOG_KEY` and `VITE_POSTHOG_HOST` → `NEXT_PUBLIC_POSTHOG_HOST`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/posthog.ts
git commit -m "fix: replace VITE_ env vars with NEXT_PUBLIC_ for PostHog"
```

---

### Task 3: Create root layout and AppEffects

Replaces `main.tsx` and the two effects in `App.tsx`. All providers live here.

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/globals.css` (move from `src/index.css`)
- Create: `apps/web/src/components/AppEffects.tsx`
- Create: `apps/web/src/components/Providers.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../hooks/useAuth`, `useSubscription` from `../hooks/useSubscription`, `identifyPostHog` from `../lib/posthog`, `initPostHog` from `../lib/posthog`, `LanguageProvider` from `../lib/i18n`, `QueryClient`/`QueryClientProvider` from `@tanstack/react-query`
- Produces: root layout wrapping all pages with providers; `AppEffects` running PostHog identify and pending-plan redirect

- [ ] **Step 1: Move `index.css` to `globals.css`**

```bash
cp apps/web/src/index.css apps/web/src/app/globals.css
```

Keep `src/index.css` in place for now — it will be deleted once `main.tsx` is removed in Task 8.

- [ ] **Step 2: Create `apps/web/src/components/Providers.tsx`**

React Query and Language providers must be client components:

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '../lib/i18n'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/components/AppEffects.tsx`**

Extracts the two `useEffect` calls from `App.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { identifyPostHog } from '../lib/posthog'

export default function AppEffects() {
  const router = useRouter()
  const { state } = useAuth()
  const { data: sub, isLoading: subLoading } = useSubscription()

  const authUserId = state?.status === 'authenticated' ? state.id : ''
  const authUsername = state?.status === 'authenticated' ? state.username : ''

  useEffect(() => {
    if (state?.status === 'authenticated' && !subLoading) {
      identifyPostHog(authUserId, { username: authUsername, plan: sub?.planSlug ?? null })
    }
  }, [state?.status, authUserId, authUsername, sub?.planSlug, subLoading])

  useEffect(() => {
    if (state?.status === 'authenticated') {
      const pending = localStorage.getItem('sandwich_pending_plan')
      if (pending === 'pro') {
        localStorage.removeItem('sandwich_pending_plan')
        router.replace('/checkout?plan=pro')
      }
    }
  }, [state?.status, router])

  return null
}
```

- [ ] **Step 4: Create `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import Providers from '../components/Providers'
import AppEffects from '../components/AppEffects'
import ErrorBoundary from '../components/ErrorBoundary'
import { initPostHog } from '../lib/posthog'
import './globals.css'

// PostHog must init before any page renders
initPostHog()

export const metadata: Metadata = {
  title: 'SANDWICH',
  description: 'From a messy brief to an execution-ready spec.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Bowlby+One&family=Mouse+Memoirs&display=swap"
          rel="stylesheet"
        />
        <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <ErrorBoundary>
          <Providers>
            <AppEffects />
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

Note: `initPostHog()` called at module level in a server component will be a no-op (no browser). Move it inside `AppEffects.tsx` useEffect if PostHog breaks — but keeping it here matches current `main.tsx` behaviour.

Actually: `initPostHog` calls `posthog.init` which needs `window`. Move the call to `AppEffects.tsx`:

```tsx
// In AppEffects.tsx, add at the top of the component:
useEffect(() => {
  initPostHog()
}, [])
```

And remove `initPostHog()` from `layout.tsx`. Update `layout.tsx` import accordingly (remove `initPostHog` import).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm --prefix apps/web run typecheck
```

Expected: errors only about missing `src/app/page.tsx` (not yet created) and deleted files — not provider/layout errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/ apps/web/src/components/AppEffects.tsx apps/web/src/components/Providers.tsx
git commit -m "feat: add Next.js root layout, Providers, AppEffects"
```

---

### Task 4: Landing page — server component wrapper + SEO

Creates `src/app/page.tsx` and updates `LandingPage.tsx` to work as a client component without the `onGoToApp` prop.

**Files:**
- Create: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/LandingPage.tsx`

**Interfaces:**
- Consumes: `LandingPage` (no props after this task), `FAQS` array from `LandingPage.tsx` (move to a shared constant)
- Produces: `GET /` returns full static HTML with meta tags and JSON-LD

- [ ] **Step 1: Extract FAQS to a shared file**

In `LandingPage.tsx`, the `FAQS` array is defined at module level. Move it to `src/lib/faqs.ts` so `page.tsx` can import it for JSON-LD without importing the client component:

Create `apps/web/src/lib/faqs.ts`:

```ts
export const FAQS = [
  {
    q: 'What can SANDWICH actually produce?',
    a: 'From a single client brief: clickable prototype, complete PRD, user flows, technical notes, client-ready quotation — all generated through one pipeline, not five separate tools.',
  },
  {
    q: 'Can it turn a messy brief into a PRD?',
    a: "Yes — that's the core job. SANDWICH takes raw, chaotic client input and structures it into a validated, machine-checkable PRD an AI agent can execute against, no guessing required.",
  },
  {
    q: 'Does it build prototypes too, or just docs?',
    a: 'Both. The same pipeline that produces the PRD also drives prototype generation, so you show the client something that matches what gets built — no drift between spec and demo.',
  },
  {
    q: 'How does the quotation get generated?',
    a: 'Once the scope is defined, SANDWICH breaks it into priced, dependency-aware line items — so the quotation is grounded in actual scope, not a guess.',
  },
  {
    q: 'Is it free?',
    a: 'Starter is Rp 50.000/month: 5 documents and 3 prototypes per month, plus 100 AI chat messages. Pro is Rp 100.000/month: unlimited everything.',
  },
]
```

In `LandingPage.tsx`, replace the `FAQS` const definition with:

```ts
import { FAQS } from '../lib/faqs'
```

- [ ] **Step 2: Update `LandingPage.tsx` — add `'use client'`, remove `onGoToApp` prop, replace navigation**

At the top of `LandingPage.tsx`, add:

```tsx
'use client'
```

Remove the `onGoToApp` prop entirely. Replace all `onGoToApp(plan?)` calls with direct `router.push(...)` calls using `useRouter` from `next/navigation`:

- `onGoToApp()` (no plan) → `router.push('/register')`
- `onGoToApp(plan.slug)` → `router.push(`/register?plan=${plan.slug}`)`
- `onGoToApp()` in hero submit (unauthenticated) → `router.push('/register')`
- The `navigate('/dashboard')` (authenticated submit) stays as `router.push('/dashboard')`
- `navigate('/login')` (nav login button) → `router.push('/login')`

Change the import at line 2 from:

```ts
import { useNavigate } from 'react-router-dom'
```

To:

```ts
import { useRouter } from 'next/navigation'
```

Change line 44 from:

```ts
const navigate = useNavigate()
```

To:

```ts
const router = useRouter()
```

Replace every `navigate(` with `router.push(` and every `onGoToApp(` call per the mapping above.

- [ ] **Step 3: Create `apps/web/src/app/page.tsx`**

```tsx
import type { Metadata } from 'next'
import LandingPage from '../components/LandingPage'
import { FAQS } from '../lib/faqs'

export const metadata: Metadata = {
  title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
  description:
    'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  keywords: [
    'PRD generator',
    'client brief to spec',
    'AI product spec',
    'product requirements document',
    'prototype generator',
    'quotation generator',
    'AI pipeline',
    'brief to PRD',
  ],
  metadataBase: new URL('https://sandwich.etalas.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SANDWICH — Brief to Spec',
    description:
      'From a messy brief to a validated PRD, prototype, quotation, and specs.',
    url: 'https://sandwich.etalas.com',
    siteName: 'SANDWICH',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingPage />
    </>
  )
}
```

- [ ] **Step 4: Verify dev server starts and landing page renders**

```bash
npm --prefix apps/web run dev
```

Open `http://localhost:3000`. Confirm landing page renders. Check browser DevTools → View Page Source: confirm `<meta name="description">`, `<meta property="og:title">`, and the JSON-LD script are present in the raw HTML (not injected by JS).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/LandingPage.tsx apps/web/src/lib/faqs.ts
git commit -m "feat: landing page as Next.js SSG server component with SEO metadata"
```

---

### Task 5: Auth page routes

Create thin `'use client'` page wrappers for login, register, verify-email, forgot-password, reset-password. Update components to use Next.js navigation.

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/verify-email/page.tsx`
- Create: `apps/web/src/app/forgot-password/page.tsx`
- Create: `apps/web/src/app/reset-password/[token]/page.tsx`
- Modify: `apps/web/src/components/LoginPage.tsx`
- Modify: `apps/web/src/components/RegisterPage.tsx`
- Modify: `apps/web/src/components/VerifyEmailPage.tsx`
- Modify: `apps/web/src/components/ForgotPasswordPage.tsx`
- Modify: `apps/web/src/components/ResetPasswordPage.tsx`

**Interfaces:**
- Consumes: existing component files
- Produces: routes `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` all render correct pages

- [ ] **Step 1: Update `LoginPage.tsx`**

Change import from `react-router-dom` to `next/navigation`:

```ts
// remove:
import { useNavigate } from 'react-router-dom'
// add:
import { useRouter } from 'next/navigation'
```

Change `const navigate = useNavigate()` to `const router = useRouter()`.

Replace all `navigate(` calls with `router.push(` (check the full file — grep first with `grep -n "navigate(" apps/web/src/components/LoginPage.tsx`).

- [ ] **Step 2: Update `RegisterPage.tsx`**

Same pattern as LoginPage:

```ts
// remove:
import { useNavigate } from 'react-router-dom'
// add:
import { useRouter } from 'next/navigation'
```

Replace `const navigate = useNavigate()` → `const router = useRouter()`. Replace `navigate(` → `router.push(`.

- [ ] **Step 3: Update `VerifyEmailPage.tsx`**

```ts
// remove:
import { useNavigate, useSearchParams } from 'react-router-dom'
// add:
import { useRouter, useSearchParams } from 'next/navigation'
```

Replace `const navigate = useNavigate()` → `const router = useRouter()`. Replace `navigate(` → `router.push(`.

Note: `useSearchParams` from `next/navigation` returns a `ReadonlyURLSearchParams` object. The call `params.get('token')` is identical — no call-site changes needed.

- [ ] **Step 4: Update `ForgotPasswordPage.tsx`**

This component currently accepts `onBack: () => void` prop (passed from `App.tsx`). Remove the prop; navigate directly:

```ts
// add import:
import { useRouter } from 'next/navigation'
```

Remove `{ onBack }` from the function signature. Replace any `onBack()` call with `router.push('/')`. Add `const router = useRouter()` inside the component.

- [ ] **Step 5: Update `ResetPasswordPage.tsx`**

```ts
// remove:
import { useNavigate, useSearchParams } from 'react-router-dom'
// add:
import { useRouter, useSearchParams } from 'next/navigation'
```

Remove `{ onBack }` prop. Replace `onBack()` → `router.push('/')`. Replace `const navigate = useNavigate()` → `const router = useRouter()`. Replace `navigate(` → `router.push(`.

`useSearchParams` from `next/navigation` — same `.get()` API, no call-site changes needed.

- [ ] **Step 6: Create `apps/web/src/app/login/page.tsx`**

```tsx
'use client'
import LoginPage from '../../components/LoginPage'
export default function Page() { return <LoginPage /> }
```

- [ ] **Step 7: Create `apps/web/src/app/register/page.tsx`**

```tsx
'use client'
import RegisterPage from '../../components/RegisterPage'
export default function Page() { return <RegisterPage /> }
```

- [ ] **Step 8: Create `apps/web/src/app/verify-email/page.tsx`**

```tsx
'use client'
import VerifyEmailPage from '../../components/VerifyEmailPage'
export default function Page() { return <VerifyEmailPage /> }
```

- [ ] **Step 9: Create `apps/web/src/app/forgot-password/page.tsx`**

```tsx
'use client'
import ForgotPasswordPage from '../../components/ForgotPasswordPage'
export default function Page() { return <ForgotPasswordPage /> }
```

- [ ] **Step 10: Create `apps/web/src/app/reset-password/[token]/page.tsx`**

`ResetPasswordPage` currently reads the token from `useSearchParams` (`?token=...`). The App Router puts it in the path param `[token]` only if we make it a path segment. But the existing backend reset-password link likely uses `?token=` query param. Keep it as a query param — the route is just `/reset-password`, no `[token]` dynamic segment needed.

Rename the folder to plain `/reset-password`:

```tsx
// apps/web/src/app/reset-password/page.tsx
'use client'
import ResetPasswordPage from '../../components/ResetPasswordPage'
export default function Page() { return <ResetPasswordPage /> }
```

Do NOT create a `[token]` segment — the token comes from `?token=` query string which `useSearchParams` already handles.

- [ ] **Step 11: Verify routes in dev**

With `npm --prefix apps/web run dev` running, visit:
- `http://localhost:3000/login` — login form renders
- `http://localhost:3000/register` — register form renders
- `http://localhost:3000/forgot-password` — forgot password form renders

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/login apps/web/src/app/register apps/web/src/app/verify-email \
  apps/web/src/app/forgot-password apps/web/src/app/reset-password \
  apps/web/src/components/LoginPage.tsx apps/web/src/components/RegisterPage.tsx \
  apps/web/src/components/VerifyEmailPage.tsx apps/web/src/components/ForgotPasswordPage.tsx \
  apps/web/src/components/ResetPasswordPage.tsx
git commit -m "feat: auth page routes (login, register, verify-email, forgot/reset-password)"
```

---

### Task 6: Dashboard and payment routes

Protected routes with inline auth guards. Update PaymentPage and PaymentReturn to use Next.js navigation.

**Files:**
- Create: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/app/pay/page.tsx`
- Create: `apps/web/src/app/pay/return/page.tsx`
- Modify: `apps/web/src/components/PaymentPage.tsx`
- Modify: `apps/web/src/components/PaymentReturn.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../hooks/useAuth`, `Dashboard`, `PaymentPage`, `PaymentReturn` components
- Produces: `/dashboard` redirects unauthenticated users to `/login`; `/pay` and `/pay/return` redirect unauthenticated users to `/login`

- [ ] **Step 1: Update `PaymentPage.tsx`**

```ts
// remove:
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
// add:
import { useRouter, useSearchParams, redirect } from 'next/navigation'
```

Replace `const navigate = useNavigate()` → `const router = useRouter()`.

Replace `const [searchParams] = useSearchParams()` → `const searchParams = useSearchParams()` (Next.js returns the object directly, not a tuple).

Replace `if (!paramPlan) return <Navigate to="/" replace />` → use `router.replace('/')` in a `useEffect` instead (can't use `redirect()` in client component after render). Pattern:

```tsx
const paramPlan = searchParams.get('plan')

useEffect(() => {
  if (!paramPlan) router.replace('/')
}, [paramPlan, router])

if (!paramPlan) return null
```

Replace `navigate(` → `router.push(`. Remove the `navigate: ReturnType<typeof useNavigate>` type annotation if it appears anywhere — replace with `router: ReturnType<typeof useRouter>`.

- [ ] **Step 2: Update `PaymentReturn.tsx`**

```ts
// remove:
import { useNavigate, useSearchParams } from 'react-router-dom'
// add:
import { useRouter, useSearchParams } from 'next/navigation'
```

Replace `const navigate = useNavigate()` → `const router = useRouter()`.
Replace `const [searchParams] = useSearchParams()` → `const searchParams = useSearchParams()`.
Replace `navigate(` → `router.push(`.

- [ ] **Step 3: Create `apps/web/src/app/dashboard/page.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import Dashboard from '../../components/Dashboard'

export default function Page() {
  const { state, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && state?.status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoading, state?.status, router])

  if (isLoading || state?.status !== 'authenticated') {
    return <div className="ds-bg min-h-screen" />
  }

  return (
    <Dashboard
      onBack={() => {
        void logout()
        router.push('/')
      }}
    />
  )
}
```

- [ ] **Step 4: Create `apps/web/src/app/pay/page.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import PaymentPage from '../../components/PaymentPage'

export default function Page() {
  const { state, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && state?.status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoading, state?.status, router])

  if (isLoading || state?.status !== 'authenticated') {
    return <div className="ds-bg min-h-screen" />
  }

  return <PaymentPage />
}
```

- [ ] **Step 5: Create `apps/web/src/app/pay/return/page.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import PaymentReturn from '../../../components/PaymentReturn'

export default function Page() {
  const { state, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && state?.status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoading, state?.status, router])

  if (isLoading || state?.status !== 'authenticated') {
    return <div className="ds-bg min-h-screen" />
  }

  return <PaymentReturn />
}
```

Note: The old route was `/checkout` and `/checkout/return`. The spec maps these to `/pay` and `/pay/return`. Confirm with the team whether existing Midtrans webhook return URLs need updating — the backend payment callback URL is `https://api.sandwich.etalas.com/api/midtrans/notification` (unaffected), but the frontend return URL passed to Snap may hardcode `/checkout/return`. Search:

```bash
grep -rn "checkout/return\|checkout\?plan" apps/web/src apps/server/src 2>/dev/null | grep -v node_modules
```

If found in frontend files, update those string literals to `/pay` and `/pay/return`. If found in backend files (e.g. Midtrans return URL passed to Snap), update the corresponding env var or hardcoded string in `apps/server/` to point to `https://sandwich.etalas.com/pay/return`.

- [ ] **Step 6: Verify protected routes**

With dev server running:
- Visit `http://localhost:3000/dashboard` while logged out → should redirect to `/login`
- Visit `http://localhost:3000/pay?plan=starter` while logged out → should redirect to `/login`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard apps/web/src/app/pay \
  apps/web/src/components/PaymentPage.tsx apps/web/src/components/PaymentReturn.tsx
git commit -m "feat: dashboard and payment routes with auth guard"
```

---

### Task 7: Share page route

**Files:**
- Create: `apps/web/src/app/share/[id]/page.tsx`
- Modify: `apps/web/src/components/SharePage.tsx`

**Interfaces:**
- Consumes: `SharePage` component; URL param `id` from path
- Produces: `/share/[id]` renders shared conversation

- [ ] **Step 1: Update `SharePage.tsx`**

Currently uses `useParams<{ token: string }>()` from react-router. In Next.js App Router, params come as a prop. Change `SharePage` to accept `token` as a prop:

```ts
// remove:
import { useParams } from 'react-router-dom'
```

Change the component signature from:

```tsx
export default function SharePage() {
  const { token } = useParams<{ token: string }>()
```

To:

```tsx
export default function SharePage({ token }: { token: string }) {
```

Remove the `useParams` call entirely. The rest of the component is unchanged.

- [ ] **Step 2: Create `apps/web/src/app/share/[id]/page.tsx`**

```tsx
'use client'
import SharePage from '../../../components/SharePage'

export default function Page({ params }: { params: { id: string } }) {
  return <SharePage token={params.id} />
}
```

- [ ] **Step 3: Verify in dev**

Visit `http://localhost:3000/share/test-token` — should render the SharePage (likely shows "not found" since the token is fake, which is correct behavior).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/share apps/web/src/components/SharePage.tsx
git commit -m "feat: share page route"
```

---

### Task 8: SEO static files and cleanup

Add `robots.txt`, `sitemap.xml` to `public/`. Delete the now-unused Vite entry files.

**Files:**
- Create: `apps/web/public/robots.txt`
- Create: `apps/web/public/sitemap.xml`
- Delete: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/src/components/PrivateRoute.tsx`, `apps/web/src/components/PrivateRoute.test.tsx`

**Interfaces:**
- Produces: `GET /robots.txt` and `GET /sitemap.xml` return correct content

- [ ] **Step 1: Create `apps/web/public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://sandwich.etalas.com/sitemap.xml
```

- [ ] **Step 2: Create `apps/web/public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sandwich.etalas.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 3: Delete unused Vite entry files**

```bash
rm apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/index.css
rm apps/web/src/components/PrivateRoute.tsx apps/web/src/components/PrivateRoute.test.tsx
```

- [ ] **Step 4: Verify `robots.txt` is served**

With dev server running, visit `http://localhost:3000/robots.txt` — should return the raw text content.

- [ ] **Step 5: Run typecheck**

```bash
npm --prefix apps/web run typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/robots.txt apps/web/public/sitemap.xml
git rm apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/index.css \
  apps/web/src/components/PrivateRoute.tsx apps/web/src/components/PrivateRoute.test.tsx
git commit -m "feat: add robots.txt and sitemap.xml; remove Vite entry files"
```

---

### Task 9: Update root `package.json` build scripts and run existing tests

The root scripts call `npm --prefix apps/web run build`. Next.js build output goes to `.next/`, not `dist/`. Verify the root build command still works and all existing tests pass.

**Files:**
- Modify: root `package.json` (only if build script needs updating)

**Interfaces:**
- Produces: `npm run build` at repo root succeeds; `npm test` passes

- [ ] **Step 1: Check root build script**

```bash
cat package.json | grep -A5 '"build"'
```

Current: `"build": "tsc -p tsconfig.json && node scripts/copy-getokui.mjs && npm --prefix apps/web run build"`

The `npm --prefix apps/web run build` calls `next build` now — that's correct. The root `tsc` and `copy-getokui.mjs` are server-side steps unaffected by this migration.

- [ ] **Step 2: Run the web build**

```bash
npm --prefix apps/web run build
```

Expected: Next.js build completes. Fix any TypeScript errors that surface only at build time.

- [ ] **Step 3: Run existing tests**

```bash
npm --prefix apps/web run test 2>/dev/null || npx --prefix apps/web vitest run
```

The test files (`*.test.tsx`) use Vitest + Testing Library. They do not depend on Vite config or react-router-dom (except `PrivateRoute.test.tsx` which was deleted). Expected: all remaining tests pass.

- [ ] **Step 4: Fix any failing tests**

Common issue: tests that import from components now using `useRouter` from `next/navigation` will need a mock. Add to test setup if needed:

```ts
// In test-setup.ts or individual test files:
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify build and tests pass after Next.js migration"
```

---

### Task 10: Catch-all 404 redirect

In the SPA, `<Route path="*" element={<Navigate to="/" replace />} />` handled unknown routes. In Next.js, add a `not-found.tsx` that redirects to `/`.

**Files:**
- Create: `apps/web/src/app/not-found.tsx`

**Interfaces:**
- Produces: any unknown path redirects to `/`

- [ ] **Step 1: Create `apps/web/src/app/not-found.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function NotFound() {
  redirect('/')
}
```

- [ ] **Step 2: Verify**

With dev server running, visit `http://localhost:3000/some-unknown-path` — should redirect to `/`.

- [ ] **Step 3: Final typecheck and build**

```bash
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
```

Both should pass cleanly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/not-found.tsx
git commit -m "feat: redirect unknown routes to home"
```
