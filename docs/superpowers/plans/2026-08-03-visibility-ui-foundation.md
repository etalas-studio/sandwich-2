# Visibility UI Foundation Implementation Plan (Retroactive)

> **Retroactive plan.** Unlike this repo's other plans, the work below was already implemented and merged to `master` (commits `a47769c`, `12b41c9`, `7097f39`, `4fd63b0`) before this plan was written. It's recorded here, task-by-task and fully checked off, so `docs/roadmap.md` can cite it the same way it cites every other architecture piece, and so the actual implementation sequence is on record. See `docs/superpowers/specs/2026-08-03-visibility-ui-foundation-design.md` for the design rationale and explicit scope boundary.

**Goal:** A static (non-real-time) web UI showing tickets as a lifecycle kanban board, with a per-ticket detail view of the internal Judge → Implement → Verify → Open PR pipeline stage, styled per `docs/design-system.html`, backed by a real `GET /api/tickets` endpoint against the SQLite storage layer.

**Explicitly not in scope** (left for a future Visibility plan): SSE live updates, first-run project-folder setup, readiness-scan overview.

---

### Task 1: Ticket list screen wired to the real tickets DB

**Commit:** `a47769c` — "Add ticket list screen wired to the real tickets DB"

- [x] Add Tailwind CSS as a real build dependency for `web/` (`web/tailwind.config.js`, `web/postcss.config.js`, `web/src/tailwind.css`), replacing the design-system doc's CDN-only setup
- [x] Add minimal `src/web-server.ts` exposing `GET /api/tickets` from the real DB, kept separate from the prior attempt's `src/server.ts`
- [x] Add dev-only seed script for sample tickets (`src/seed-tickets.ts`)
- [x] Add the ticket list screen (`web/src/components/TicketList.tsx`) as the web app's entry point, styled per `docs/design-system.html`

### Task 2: Rename npm scripts so the new app owns the normal run commands

**Commit:** `12b41c9` — "Rename npm scripts so the new app owns the normal run commands"

- [x] `npm start` / `npm run serve` run the new app (build, seed demo data, serve)
- [x] Prior-attempt equivalents moved to `start:legacy` / `serve:legacy`

### Task 3: Ticket-lifecycle kanban board, status, and detail panel

**Commit:** `7097f39` — "Add ticket-lifecycle kanban board, list status, and ticket detail panel"

- [x] Add `getLatestRunForTicket` to `src/db/runs.ts`
- [x] Rename seed script to `seed-demo-data.ts`; extend it to seed a spread of run states (backlog, two in-progress stages, two different blocked reasons, ready-for-review)
- [x] `GET /api/tickets` now embeds each ticket's latest run
- [x] Add the ticket-lifecycle kanban board (`web/src/components/TicketBoard.tsx`: Backlog/In Progress/Blocked/Ready for Review), distinct from the internal Judge/Implement/Verify/Open PR pipeline stage
- [x] Add the ticket detail slide-over (`web/src/components/TicketDetail.tsx`) showing the Judge → Implement → Verify → Open PR stepper and blocked/PR context
- [x] Add List/Board toggle in `web/src/Shell.tsx`
- [x] Readiness overview intentionally left out of this round

### Task 4: Rebuild frontend with full design system adoption

**Commit:** `4fd63b0` — "Rebuild frontend with design system"

- [x] Remove old UI (`App.tsx` with Queue/Review/Metrics tabs — the prior attempt's own screens)
- [x] New dashboard layout matching `docs/design-system.html`: sidebar navigation (Overview, Tickets, Users, Settings), stats cards (Agent Success Rate, Avg Duration, Autonomy Rate), kanban board, ticket detail overlay with pipeline stepper
- [x] Full design-system token adoption: `ds-card-outer`/`ds-card-inner` wrapper pattern, `ds-noise` texture, `ds-shadow-elevated`/`ds-text-shadow`, gradient status badges
- [x] Wire to `/api/tickets`; fall back to bundled mock data (`web/src/mockData.ts`) with a visible connection-error banner if the server is unreachable
- [x] Upgrade to React 19 + Vite 8 + Tailwind CSS 4

---

## Follow-up (not this plan)

A future Visibility plan needs its own brainstorm → spec cycle for: SSE-based live pipeline updates, first-run project-folder picker + initial readiness scan review, and the readiness overview screen. Until that plan exists and merges, `docs/roadmap.md`'s Visibility checkbox stays unchecked.
