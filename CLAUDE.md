# CLAUDE.md — Project Context

Written 2 August 2026. This file was reset to zero on this date.

## Why This Is Nearly Empty

The project paused to restart its product direction from first principles, rather than continuing to build on the architecture of a single prior attempt as if it were already the answer. The previous docs (`CLAUDE.md`, `docs/00`–`05`) described one project's specific pilot — its architecture ("two-stage plan/approve/implement," "gates from diff," "blocklist-based guardrails," "serial job queue," etc.), its numbers, and its context — treated as if these were already-settled product decisions. They were removed entirely (not just archived) so they can't passively leak into future context or nudge design decisions by proximity. A backup branch (`backup/pre-reset-2026-08-02`) holds them if that history is ever needed, but nothing in this working branch should be assumed to carry forward from it.

## What's Actually Settled Right Now

Very little. The codebase in `src/` and `web/` still exists and still runs (verify with `npm run build` and `npm run selftest`), but its design is being treated as **one candidate to learn from**, not as the foundation to keep extending.

## Next Step

A product roadmap is being rebuilt from scratch — see whichever doc supersedes this note once that work starts. Until then, treat any existing code or config in this repo as historical material to consult, not as settled direction.
