# Next.js Migration Design

**Date:** 2026-08-19
**Scope:** Replace `apps/web` (React 19 SPA, Vite) with Next.js App Router. Same subdomain `sandwich.etalas.com`. Primary goal: SEO for landing page.

---

## 1. Approach

App Router with landing page as SSG server component; all other pages `'use client'`. No URL-based i18n — client-side language toggle (EN/ID) is preserved as-is.

---

## 2. Folder Structure

```
apps/web/
  src/
    app/
      layout.tsx                    ← root layout: fonts, providers, AppEffects
      page.tsx                      ← landing (server component, exports metadata + JSON-LD)
      dashboard/page.tsx            ← 'use client' wrapper around <Dashboard />
      login/page.tsx                ← 'use client' wrapper around <LoginPage />
      register/page.tsx             ← 'use client' wrapper around <RegisterPage />
      verify-email/page.tsx
      forgot-password/page.tsx
      reset-password/[token]/page.tsx
      pay/page.tsx
      pay/return/page.tsx
      share/[id]/page.tsx
    components/                     ← existing, mostly unchanged
    hooks/                          ← unchanged
    lib/                            ← unchanged
    api/                            ← unchanged
  public/
    robots.txt                      ← new
    sitemap.xml                     ← new
    favicon.ico                     ← new
    og-image.png                    ← new (1200×630, needs design)
    sandwich.webp                   ← existing
    logos/                          ← existing
    ingredients/                    ← existing
```

`src/app/` sits inside the existing `src/` directory — all existing imports (`../components/...`, `../hooks/...`, etc.) work without changes.

---

## 3. Server vs Client Boundary

- `app/page.tsx` — server component. Exports `metadata`, renders `<LandingPage />`.
- `LandingPage.tsx` — add `'use client'` at top. Has form state, intersection observers, auth checks. Next.js SSG pre-renders it to static HTML at build time; Googlebot sees all content. Hydrates in browser as normal.
- All other pages — `'use client'` thin wrappers: `export default function Page() { return <ExistingComponent /> }`.
- `App.tsx` — deleted. Routing is filesystem.
- `PrivateRoute.tsx` — deleted. Each protected page guards itself (see Section 4).

---

## 4. Auth & Routing

`AuthProvider` and `QueryClientProvider` move to `app/layout.tsx`. The `useAuth` hook and all auth API calls are unchanged.

**Route protection** — inlined per protected page:

```tsx
'use client'
export default function Page() {
  const { state } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (state.status === 'unauthenticated') router.replace('/login')
  }, [state.status])
  if (state.status !== 'authenticated') return null
  return <Dashboard ... />
}
```

**Navigation** — every `useNavigate()` becomes `useRouter()` from `next/navigation`; every `<Link>` import changes from `react-router-dom` to `next/link`. Call sites are identical.

**`AppEffects.tsx`** — new `'use client'` component mounted in `app/layout.tsx`. Contains:
- Pending plan redirect (`sandwich_pending_plan` localStorage check)
- PostHog identify effect

These currently live in `App.tsx` which is deleted.

**Deleted dependencies:** `react-router-dom`.

---

## 5. SEO & Metadata

`app/page.tsx` exports:

```tsx
export const metadata: Metadata = {
  title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
  description: 'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  keywords: ['PRD generator', 'client brief to spec', 'AI product spec', 'product requirements document', 'prototype generator', 'quotation generator', 'AI pipeline', 'brief to PRD'],
  metadataBase: new URL('https://sandwich.etalas.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SANDWICH — Brief to Spec',
    description: 'From a messy brief to a validated PRD, prototype, quotation, and specs.',
    url: 'https://sandwich.etalas.com',
    siteName: 'SANDWICH',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}
```

**JSON-LD (FAQPage schema)** — injected as `<script type="application/ld+json">` in `app/page.tsx`, built from the `FAQS` array already defined in `LandingPage.tsx`. Enables rich snippets in Google results.

**`app/layout.tsx` `<head>` additions:**
- `<link rel="preconnect" href="https://fonts.googleapis.com">`
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous">`
- `<link rel="icon" href="/favicon.ico">`
- `<html lang="en">` — static; client-side language toggle still works, does not update this attribute (accepted tradeoff for Option A / no URL-based i18n)

**`public/robots.txt`:**
```
User-agent: *
Allow: /
Sitemap: https://sandwich.etalas.com/sitemap.xml
```

**`public/sitemap.xml`:** single URL entry for `https://sandwich.etalas.com/`.

**`og-image.png`** (1200×630) — does not exist yet; needs to be created separately before deploy.

---

## 6. Build & Deploy

**`apps/web/package.json` changes:**
- Remove: `vite`, `@vitejs/plugin-react`, `react-router-dom`
- Add: `next`
- Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`
- All other deps unchanged (React 19, Tailwind 4, React Query, etc.)

**`next.config.ts`** — minimal:
```ts
import type { NextConfig } from 'next'
const config: NextConfig = {}
export default config
```
No `basePath`. No `output: 'standalone'` (Vercel deploy, not Railway).

**`vercel.json`** — remove the SPA rewrite entirely. Vercel auto-detects Next.js. New content:
```json
{}
```
Or delete the file if no other Vercel config is needed.

**Root `package.json` scripts** — unchanged. `npm --prefix apps/web run build` works with Next.js.

**Tailwind 4** — already uses `@tailwindcss/postcss`; compatible with Next.js, no changes needed.

---

## 7. Files Deleted

- `apps/web/src/App.tsx`
- `apps/web/src/components/PrivateRoute.tsx`
- `apps/web/index.html`
- `apps/web/vite.config.ts`

---

## 8. Out of Scope

- `og-image.png` design
- URL-based i18n (`/en/`, `/id/`)
- SSR for auth/dashboard pages
- Any backend changes
