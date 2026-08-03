# Visibility UI Foundation — Design Doc (Retroactive)

**Written 2026-08-03, after the fact.** The work this doc describes (commits `a47769c`, `12b41c9`, `7097f39`, `4fd63b0` on `master`) was built and merged without going through the brainstorm → spec → plan cycle `CLAUDE.md` otherwise requires, and without the roadmap checkbox it touches being updated. This doc and its companion plan (`docs/superpowers/plans/2026-08-03-visibility-ui-foundation.md`) exist to reconcile that: describe what was actually built, what it deliberately does not cover, and bring `docs/roadmap.md` back in sync with merged code. Nothing here changes the code — it documents a decision that was already made in practice.

## Why this got built before the pipeline engine

Phase 1's Visibility piece (spec: `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`, "Visibility: web UI + SSE") is real-time observability into per-ticket pipeline runs. But the actual pipeline (Judge → Implement → Verify → Open PR) doesn't exist yet — only Agent engine and Storage are done. Rather than wait, this work built the UI shell against seeded mock run data (`src/seed-demo-data.ts`) spanning a spread of lifecycle states, so the visual/interaction design could be validated against `docs/design-system.html` immediately. This is a legitimate sequencing call — but it should have been scoped as its own small spec before implementation, not decided implicitly through commit messages.

## What this covers

- **Ticket list → kanban board.** Tickets render as a lifecycle board with four columns — Backlog / In Progress / Blocked / Ready for Review (renamed to "Done" in the final rebuild) — sourced from `GET /api/tickets`, a single endpoint in `src/web-server.ts` that joins each ticket with its latest run (`getLatestRunForTicket`, `src/db/runs.ts`).
- **Ticket detail overlay.** Clicking a ticket opens a slide-over (`web/src/components/TicketDetail.tsx`) showing the internal pipeline stepper (Judge → Implement → Verify → Open PR) for its latest run, plus blocked-reason and PR context when applicable. This is intentionally a *different* axis than the kanban column: board position is ticket lifecycle status, the stepper is per-run pipeline stage — the spec's Core Loop section treats "needs-human" as a labeled outcome attached to whichever stage produced it, not a separate visual state, and the detail view reflects that.
- **Design system adoption.** Full UI rebuild (`4fd63b0`) onto `docs/design-system.html`'s Tailwind classes and visual language (`ds-card-outer`/`ds-card-inner`, noise texture, gradient status badges, elevated shadows) — replacing the prior attempt's own UI (`App.tsx` Queue/Review/Metrics tabs) entirely rather than extending it, consistent with `CLAUDE.md`'s framing of the old code as "one candidate to learn from."
- **Resilience fallback.** The app calls the real API first; if it's unreachable, it falls back to bundled mock data (`web/src/mockData.ts`) with a visible "Could not connect to server" banner, rather than a blank screen — useful during development before a project has been pointed at a real DB, but not a substitute for the API path.
- **Stats cards** (Agent Success Rate, Avg Duration, Autonomy Rate) computed client-side from whatever ticket set is currently displayed (`computeStats` in `web/src/types.ts`) — illustrative given only seeded mock runs exist so far, not yet meaningful metrics.

## What this deliberately does not cover

These remain open against the Visibility architecture piece in `docs/roadmap.md`:

- **Real-time push (SSE).** The spec calls for Server-Sent Events so a run's pipeline-stage changes appear live. Today's UI does a single `fetch('/api/tickets')` on load (`web/src/types.ts`, `useTickets`) — no live updates, no reconnect logic, no per-run event stream.
- **First-run project-folder setup.** The spec's Core Loop step 0 (folder picker → kick off initial readiness scan → human reviews readiness map + proposed blocklist before anything can run) has no UI yet. There's no picker, and no readiness-scan surface at all.
- **Readiness overview.** Explicitly called out as deferred in the `7097f39` commit message — the periodic, non-per-ticket readiness scan (spec section 1) has no view.

Because these three gaps are exactly what the spec's Visibility piece requires, `docs/roadmap.md`'s Visibility checkbox stays unchecked — this work is real progress toward it, not the completed piece.

## Architecture notes worth carrying forward

- `src/web-server.ts` is a minimal `node:http` server (no framework) serving one API route (`GET /api/tickets`) plus static files from `web/dist`, deliberately kept separate from the prior attempt's `src/server.ts` (job/lane model). Adding SSE later means adding a second route (e.g. `GET /api/events`) to this same file, or splitting it out — not a rewrite.
- `npm start` / `npm run serve` now run this new app (build → seed demo data → serve); the prior attempt's equivalents moved to `start:legacy` / `serve:legacy` so both remain runnable.
- Ticket lifecycle status (kanban column) and pipeline stage (detail stepper) are stored/derived separately and must stay that way — collapsing them would reintroduce the ambiguity the product design explicitly avoided (see Core Loop, "Needs-human is a labeled outcome, not a 5th pipeline stage").
