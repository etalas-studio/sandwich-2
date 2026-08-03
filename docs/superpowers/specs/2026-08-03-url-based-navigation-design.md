# URL-Based Navigation Design

Date: 2026-08-03

## Problem

Current navigation is state-based (`activeNav`, `selectedTicket`). This means:
- No shareable URLs for specific views
- Browser back button doesn't work as expected
- Can't bookmark a ticket detail view

## Solution

Replace state-based navigation with URL-based routing using `react-router-dom`.

## Routes

| Route | Content |
|-------|---------|
| `/` | Redirects to `/overview` |
| `/overview` | Empty placeholder (home) |
| `/tickets` | Kanban board + stats |
| `/tickets?selected=KEY` | Tickets + ticket detail overlay |
| `/settings` | Settings page |

## Architecture

### Components

**App.tsx**
- Wrap in `<BrowserRouter>`
- Define routes with `<Routes>` and `<Route>`
- Remove `activeNav` state — use `useLocation()` for sidebar highlight
- Remove `selectedTicket` state — use `useSearchParams()` for `?selected=KEY`

**Sidebar.tsx**
- Replace `onNavigate` callback with `<Link>` components
- Highlight active nav based on `useLocation()`

**Settings.tsx**
- Replace `onBack` callback with `<Link to="/overview">`

**TicketDetail.tsx**
- No changes — still receives `ticket` as prop from parent

### URL Structure

```
/                    → <Navigate to="/overview" />
/overview            → Overview placeholder
/tickets             → Tickets list (kanban + stats)
/tickets?selected=RR-7338   → Tickets list + ticket detail overlay
/settings            → Settings page
```

### Query Param Behavior

- `?selected=KEY` opens ticket detail overlay
- No `selected` param → overlay closed
- Invalid/non-existent key → overlay closed (graceful fallback)
- When overlay closes → remove `selected` param from URL

## Implementation Steps

1. Install `react-router-dom`
2. Update `main.tsx` — wrap `<App />` with `<BrowserRouter>`
3. Update `App.tsx`:
   - Add route definitions
   - Replace `activeNav` with `useLocation()`
   - Replace `selectedTicket` with `useSearchParams()`
   - Add navigation helpers
4. Update `Sidebar.tsx` — use `<Link>` and `useLocation()`
5. Update `Settings.tsx` — replace `onBack` with `<Link>`
6. Test all navigation paths

## Success Criteria

- [ ] Direct URL navigation works (typing URL in address bar)
- [ ] Browser back/forward buttons work correctly
- [ ] Shareable ticket detail URLs (`/tickets?selected=RR-7338`)
- [ ] Sidebar correctly highlights active nav item
- [ ] All existing functionality preserved
