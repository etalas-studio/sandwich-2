# CLAUDE.md — Project Context

Written 2 August 2026. This file was reset to zero on this date.

## Why This Is Nearly Empty

The project paused to restart its product direction from first principles, rather than continuing to build on the architecture of a single prior attempt as if it were already the answer. The previous `CLAUDE.md` — including its architectural rules ("two-stage plan/approve/implement," "gates from diff," "blocklist-based guardrails," "serial job queue," etc.) — described one project's specific pilot, not necessarily decisions that hold for what comes next.

That file is preserved at `docs/archive/CLAUDE-project1-pilot.md` **as information, not as constraint.** It may still be useful to read for context on how one system was built and what was learned running it — but nothing in it should be treated as already-decided. If this project reaches the same conclusions again, they need to be re-derived on their own merits, not inherited.

## What's Actually Settled Right Now

Very little. The codebase in `src/` and `web/` still exists and still runs (verify with `npm run build` and `npm run selftest`), but its design is being treated as **one candidate to learn from**, not as the foundation to keep extending.

## Next Step

A product roadmap is being rebuilt from scratch — see whichever doc supersedes this note once that work starts. Until then, treat any existing code, config, or docs elsewhere in this repo as historical material to consult, not as settled direction.
