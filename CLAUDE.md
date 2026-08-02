# CLAUDE.md — Project Context

Written 2 August 2026. This file was reset to zero on this date, then updated as the product restart progressed.

## Why This Was Reset

The project paused to restart its product direction from first principles, rather than continuing to build on the architecture of a single prior attempt as if it were already the answer. The previous docs (`CLAUDE.md`, `docs/00`–`05`) described one project's specific pilot and were removed entirely (not archived) so they couldn't passively leak into new design decisions. A backup branch (`backup/pre-reset-2026-08-02`) holds that history if it's ever needed, but nothing in this working branch carries forward from it.

## Current Status

| Phase | Status |
|---|---|
| Product design (problem, core loop, architecture) | Done — see `docs/superpowers/specs/2026-08-02-phase-1-product-design.md` |
| Implementation plan | Not yet written |
| Implementation | Not started |

The codebase in `src/` and `web/` from the prior attempt still exists and still runs (verify with `npm run build` and `npm run selftest`), but its design is treated as **one candidate to learn from**, not the foundation being extended. Phase 1 implementation may reuse pieces of it where they genuinely fit the new design — not by default inheritance.

## Where To Look

| Document | What it's for |
|---|---|
| `docs/roadmap.md` | Phase list at a glance — start here |
| `docs/superpowers/specs/2026-08-02-phase-1-product-design.md` | Full Phase 1 design: problem, core loop, architecture decisions |
| `docs/superpowers/plans/` | Implementation plans (task-by-task), once written |
| `docs/design-system.html` | Visual design system — all UI components live here. Copy Tailwind classes directly. |
| `CHANGELOG.md` | One entry per completed implementation task |

## Working Rules

- Run `npm run build` and `npm run selftest` before and after any code change, to confirm nothing already-working broke.
- When a task from an implementation plan completes, append one line to `CHANGELOG.md` as part of that task's completion commit — don't batch it up for later.
