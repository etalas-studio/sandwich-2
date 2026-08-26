# Admin Panel Expansion — Design Spec

**Date:** 2026-08-26  
**Branch:** worktree-feat+admin-panel-expansion

---

## Overview

Replace the current single-page `/admin` (AI engine config only) with three separate routes: **Dashboard**, **Users**, and **Configuration**. Configuration is the current page content, moved verbatim. Dashboard and Users are new.

---

## Architecture

### Routes

| URL | Description |
|---|---|
| `/admin` | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | Stats overview + recent payments |
| `/admin/users` | Paginated user management table |
| `/admin/config` | Current AI engine + provider config (existing content) |

A shared `apps/web/src/app/admin/layout.tsx` wraps all three with the auth guard and a nav sidebar/header linking between the three pages. The existing `apps/web/src/app/admin/page.tsx` becomes a simple redirect to `/admin/dashboard`.

### New server routes (`apps/server/routes/admin.ts`)

**`GET /api/admin/stats`**  
Returns aggregates for the Dashboard tile row and recent payments table.

```ts
{
  totalUsers: number
  activeProSubs: number
  starterUsers: number
  revenueThisMonth: number          // sum of gross_amount (IDR) where transaction_status = 'settlement' and created_at >= start-of-month
  usageThisMonth: { doc: number; prototype: number; chat: number }  // sum across all users
  recentPayments: Array<{
    orderId: string
    userEmail: string | null
    planSlug: string | null
    grossAmount: string
    transactionStatus: string
    fraudStatus: string | null
    createdAt: string               // ISO-8601
  }>                                // last 10, desc
}
```

Queries:
- `totalUsers`: `SELECT COUNT(*) FROM users`
- `activeProSubs`: `SELECT COUNT(*) FROM subscriptions WHERE plan_slug = 'pro' AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`
- `starterUsers`: `totalUsers - activeProSubs` (computed server-side)
- `revenueThisMonth`: join `payments` where `transaction_status = 'settlement'` and `created_at >= date_trunc('month', NOW())`, sum `gross_amount::numeric`
- `usageThisMonth`: `SELECT kind, SUM(count) FROM usage WHERE year_month = 'YYYY-MM' GROUP BY kind`
- `recentPayments`: join `payments LEFT JOIN users ON payments.user_id = users.id ORDER BY payments.created_at DESC LIMIT 10`

**`GET /api/admin/users?page=N&limit=50`**  
Paginated user list with subscription and current-month usage.

```ts
{
  users: Array<{
    id: string
    email: string
    username: string
    role: string
    emailVerified: boolean
    createdAt: string
    subscription: {
      planSlug: string
      status: string
      expiresAt: string | null
    } | null
    usageThisMonth: { doc: number; prototype: number; chat: number }
  }>
  total: number
  page: number
}
```

Query: `SELECT users.*, subscriptions.*, usage aggregated` — single SQL with LEFT JOINs + subquery for usage, ordered by `users.created_at DESC`. Pagination via `LIMIT/OFFSET`.

**`POST /api/admin/users/:id/role`**  
Body: `{ role: "user" | "admin" }`. Calls existing `updateUserRole`. Returns `{ ok: true }`.

**`POST /api/admin/users/:id/subscription`**  
Body: `{ action: "cancel" | "grant"; planSlug?: string }`.
- `cancel` → calls existing `cancelSubscription`
- `grant` → calls existing `activateSubscription` with `planSlug` (must be `"starter"` or `"pro"`)

Returns `{ ok: true }`.

---

## Frontend

### Files touched

| File | Change |
|---|---|
| `apps/web/src/app/admin/page.tsx` | Replace with redirect to `/admin/dashboard` |
| `apps/web/src/app/admin/layout.tsx` | New — shared auth guard + nav links |
| `apps/web/src/app/admin/dashboard/page.tsx` | New — stat tiles + recent payments |
| `apps/web/src/app/admin/users/page.tsx` | New — paginated user table + row actions |
| `apps/web/src/app/admin/config/page.tsx` | New — current page.tsx content, extracted verbatim |
| `apps/web/src/api/admin.ts` | Add `fetchAdminStats`, `fetchAdminUsers`, `setUserRole`, `manageUserSubscription` |

### Layout (`layout.tsx`)

Wraps all admin routes. Handles the `unauthenticated` and `non-admin` redirects/guards that currently live in `page.tsx`. Renders a simple nav bar with links to Dashboard, Users, Configuration — active link highlighted by current pathname.

### DashboardTab

- **Stat tile row** (4 tiles): Total Users, Active Pro, Starter Users, Revenue This Month (formatted as `Rp X.XXX`)
- **Usage row** (3 tiles): Docs, Prototypes, Chat messages — this month across all users
- **Recent Payments table**: columns — Order ID (truncated), Email, Plan, Amount, Status (color-coded: settlement=green, pending=yellow, others=red), Fraud, Date

### UsersTab

- **Paginated table** (50/page): Email, Username, Role badge, Plan badge, Sub expiry, Doc usage / Proto usage / Chat usage (this month)
- **Row actions** (dropdown or inline buttons):
  - Toggle role: `user ↔ admin` — confirm dialog before promoting to admin
  - Cancel subscription — only shown when active sub exists
  - Grant Pro — grants `pro` plan immediately (support/comp tool)
  - Grant Starter — resets to starter
- Pagination controls at bottom (Prev / page N of M / Next)

### `/admin/config`

Current `page.tsx` body moved verbatim. Auth guard moves to `layout.tsx`; this page has no guard logic of its own.

---

## Data types (shared)

Add to `apps/web/src/api/admin.ts`:

```ts
export interface AdminStats { ... }           // matches server shape above
export interface AdminUser { ... }            // matches server shape above
export interface AdminUsersResponse { ... }
```

---

## Error handling

- All new API functions follow the existing `request<T>()` pattern in `admin.ts` — throws on non-2xx with server's `error` message.
- `SectionBanner` component (existing) used for per-tab error display.
- Confirm dialogs for destructive row actions (role promotion, cancel sub) are native `window.confirm` — sufficient for an internal operator panel.

---

## Security

- All four new routes gated by `requireAdmin` (same as existing routes) — no new auth surface.
- `role` input on POST validated server-side: only `"user"` or `"admin"` accepted.
- `action` on subscription POST validated: only `"cancel"` or `"grant"` accepted; `planSlug` validated against `PLANS` keys.

---

## Testing

- New server route handlers get unit tests in `apps/server/routes/admin.test.ts` (following `conversation-run.test.ts` pattern): stats aggregation, user list pagination, role update, subscription manage — covering happy path and invalid inputs.
- No new frontend tests (operator panel, low risk).

---

## Out of scope

- Search/filter on the users table (add when count warrants it)
- Bulk actions
- Audit log
- Charts/graphs (stat tiles only for now)
