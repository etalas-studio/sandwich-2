# Auto PR Toggle — Design

4 August 2026

## Problem

The Settings page has an "Auto Open PR" toggle, but when auto-PR is disabled the pipeline
skips the entire `open_pr` stage — including AI-generated PR content (title, description).
The ticket lands in done with a bare message and no way to manually trigger PR creation later.

## What we're building

When auto-PR is **off**, the pipeline still generates PR content via AI (with mechanical
fallback) and stores it. Later, the user can press an "Open PR" button on the done ticket
to execute the mechanical part (git push + VCS API create PR) using the stored content.

When auto-PR is **on**, nothing changes — the pipeline does everything inline as before.

## Architecture

### Refactor `runOpenPr` into two parts

`src/pipeline/ticket-runner.ts` — the internal `runOpenPr` function currently does everything
in one 200-line block. We split it:

1. **`generatePrContent()`** — takes ticket info + worktree path + modelId, returns `{ title, description }`.
   Same AI call with same fallback template as today. Pure content generation — no side effects.

2. **`executePr()`** — takes `{ db, ticket, repoPath, title, description }`, does git push +
   VCS API create PR + worktree cleanup. Pure mechanical — no AI.

`runOpenPr` stays as the combined entry point that calls both in sequence (for the auto-PR ON path).

### Pipeline stage branching

In the main stage loop (`case "open_pr":`):

**Auto-PR ON** (no change):
```
generatePrContent() → executePr() → ticket done + prUrl
```

**Auto-PR OFF**:
```
generatePrContent() → store prTitle + prDescription in DB → ticket done
prSummary = "PR content ready — click Open PR to create."
(no prUrl)
```

### Database migration

Two new nullable columns on `tickets`:

```sql
ALTER TABLE tickets ADD COLUMN pr_title TEXT;
ALTER TABLE tickets ADD COLUMN pr_description TEXT;
```

Migration file: `src/db/migrations/0010_add_pr_content_columns.ts`

### New API endpoint

`POST /api/tickets/:key/open-pr`

- Validates the ticket exists, status is `done`, `prTitle` and `prDescription` are present
- Calls `executePr()` with stored content
- Updates ticket with `prUrl`, clears stored content
- Returns `{ prUrl }`

Route registered in `src/routes/tickets.ts`.

### Frontend

**`web/src/components/TicketDetail.tsx`** — in the "Done state" section:

Current logic:
```tsx
{ticket.status === 'done' && ticket.prUrl && (
  // show PR link
)}
```

New logic:
```tsx
{ticket.status === 'done' && ticket.prUrl && (
  // show PR link (existing)
)}
{ticket.status === 'done' && !ticket.prUrl && ticket.prTitle && (
  // show "Open PR" button
)}
```

The "Open PR" button:
- Calls the new `/api/tickets/:key/open-pr` endpoint
- Shows loading state while request is in flight
- On success: shows the PR URL (replaces the button)
- On error: shows inline error message

**Types update** (`web/src/types.ts`, `web/src/api/tickets.ts`):
- Add `prTitle?: string` and `prDescription?: string` to the `Ticket` type
- Add `openPr(ticketKey: string)` function to the tickets API module

**Backend type** (`src/db/tickets.ts`):
- Add `prTitle` and `prDescription` to the `Ticket` interface
- Add them to the INSERT and UPDATE queries

## Data flow

```
Settings page: toggle OFF
        │
        ▼
Pipeline reaches open_pr stage
        │
        ▼
generatePrContent() → { title: "Fix: ...", description: "..." }
        │
        ▼
Store in DB: tickets.pr_title, tickets.pr_description
        │
        ▼
Ticket marked done (no prUrl)
        │
        ▼  (later, user opens ticket detail)
        │
TicketDetail: shows "Open PR" button
        │
        ▼  (user clicks)
POST /api/tickets/:key/open-pr
        │
        ▼
executePr({ title, description }) → git push + create PR
        │
        ▼
Ticket updated with prUrl, content columns cleared
        │
        ▼
UI shows PR link
```

## Error handling

| Scenario | Behavior |
|---|---|
| No project configured | API returns 400, "No project configured" |
| VCS token expired | API returns 400, "reconnect provider" |
| Branch already has a PR | Reuse existing PR URL (same as today's findPullRequest logic) |
| Push fails | API returns 500, error message |
| PR creation fails | Remote branch is deleted, API returns 500 |
| AI content generation fails | Falls back to mechanical template (same as today) |
| Ticket done but no prTitle stored | "Open PR" button hidden (graceful — shouldn't happen in practice) |
| Worktree cleanup fails | Best-effort, swallowed |

## Testing

### Unit/integration (backend)

- `runOpenPr` with auto-PR ON: generates content + creates PR (existing behavior verified)
- Pipeline with auto-PR OFF: generates content, stores in DB, marks done without prUrl
- `POST /api/tickets/:key/open-pr`: creates PR from stored content, updates ticket
- `POST /api/tickets/:key/open-pr` when prTitle is empty: returns 400
- AI failure during content generation: falls back to mechanical template

### Frontend

- TicketDetail shows "Open PR" button when done + prTitle present + no prUrl
- TicketDetail shows PR link when prUrl present (existing, no regression)
- Button click triggers API call, shows loading, updates on success/error

## Migration path

Single migration (`0010`) adding two nullable text columns to `tickets` — no data migration
needed, existing rows just get `NULL` for both columns.

No breaking changes to any existing API.
