# CLAUDE.md — Project Context

Written 2 August 2026. This file was reset to zero on this date, then updated as the product restart progressed.

## Why This Was Reset

The project paused to restart its product direction from first principles, rather than continuing to build on the architecture of a single prior attempt as if it were already the answer. The previous docs (`CLAUDE.md`, `docs/00`–`05`) described one project's specific pilot and were removed entirely (not archived) so they couldn't passively leak into new design decisions. A backup branch (`backup/pre-reset-2026-08-02`) holds that history if it's ever needed, but nothing in this working branch carries forward from it.

## Current Status

Status (what's done, what's next) lives entirely in `docs/roadmap.md` — do not duplicate it here. This file only orients; roadmap.md tracks.

The codebase in `src/` and `web/` from the prior attempt still exists and still runs (verify with `npm run build` and `npm run selftest`), but its design is treated as **one candidate to learn from**, not the foundation being extended. Phase 1 implementation may reuse pieces of it where they genuinely fit the new design — not by default inheritance.

## Where To Look

| Document | What it's for |
|---|---|
| `docs/roadmap.md` | Phase list + architecture checklist — status lives here, start here |
| `docs/superpowers/specs/2026-08-02-phase-1-product-design.md` | Full Phase 1 design: problem, core loop, architecture decisions |
| `docs/superpowers/plans/` | Implementation plans (task-by-task), once written |
| `docs/design-system.html` | Visual design system — all UI components live here. Copy Tailwind classes directly. |
| `CHANGELOG.md` | One entry per completed implementation task |

## Working Rules

- Run `npm run build` and `npm run selftest` before and after any code change, to confirm nothing already-working broke.
- When a task from an implementation plan completes, append one line to `CHANGELOG.md` (format: `- YYYY-MM-DD: [plan-name] | @githubusername - what it delivered`) as part of that task's completion commit — don't batch it up for later.
- **IMPORTANT:** Status must never lag merged code. In the same commit that finishes a task: check off that task's checkbox in its plan file. In the same commit that finishes a plan's *last* task: flip that architecture piece's checkbox in `docs/roadmap.md` to done too.
- Work on a plan happens on a branch named after the plan (e.g. `engine-invocation-layer`), merged back once the plan's tasks are done.
- `node-pty` requires its native `spawn-helper` binary to actually be executable after install — check this first if PTY-mode invocation misbehaves right after a fresh `npm install`.
- **IMPORTANT — costs real tokens:** `src/engine/manual-check.ts` and `src/engine/manual-check-pty.ts` invoke the real Claude Code CLI (not a fake/mocked one). Never run either of them, or anything that shells out to them, without the human's explicit go-ahead in the current conversation. Both refuse to run unless `ALLOW_LIVE_CLAUDE_CHECK=1` is set — do not set that env var on the user's behalf to work around the guard. (Everything under `npm run build`/`npm run selftest` and the `*.test.ts` files are safe — they use a fake `claude` binary and never touch the network.)
