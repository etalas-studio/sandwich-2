# Product Roadmap — Design

Written 2 August 2026.

## Why this document exists

The project paused mid-build to answer a question that had never been made explicit: **what is this, for whom, and in what order do we build it.** This document is the answer, written down so future implementation sessions (via `writing-plans`) have a fixed reference instead of re-litigating scope each time.

This is a **roadmap**, not a spec for a single feature. It exists one level above the individual design docs in this folder — each workstream below gets its own brainstorm → spec → plan cycle when its turn comes, using this document only to know what's next and why.

## Terminology

- **Organization** — the entity that owns one or more projects. One organization can have several projects at once.
- **Project** — one target codebase/repository the orchestrator is pointed at. This is the unit of granularity that matters here.
- **Instance** — one running copy of the orchestrator. **One instance always serves exactly one project.** An organization with multiple projects runs multiple instances, one per project — not one instance juggling several.

## What This Product Is

An orchestrator that runs a coding agent per ticket in a separate git worktree, enforces guardrails, and records every attempt — for **any project's codebase**, not one specific codebase.

**Operating model: single-tenant per instance.** One running instance always serves exactly one project's repository. Pointing at a different project means swapping the config folder, not changing code. There is no multi-project server, no per-project routing, no shared instance serving several repos at once — that's explicitly out of scope (see "Not Doing" below).

**Each instance is delivered to its project in full.** The organization receives the whole clone for that project — source code, config, the works. This has one hard consequence for how the codebase must be structured: **anything that is the operator's own working process (not part of the tool itself) must never live in a file that ships with the delivered instance.** Conversely, anything that describes the specific project's codebase (which paths are off-limits, what language/test framework it uses, business context for prompts) belongs in that project's own config — it's fine for that to be specific, because it only ever lives in that project's own copy.

**The first real instance is already in progress** (an active pilot, mid-way through, for the first project). It is not a demo for this roadmap — it is the one dataset this whole roadmap depends on. If it produces no usable numbers, there is no case for setting up a second project's instance at all.

## Current State (as of this writing)

| Area | Status |
|---|---|
| Two-stage orchestrator (plan → approve → implement) | Working, typecheck clean, 38 self-tests passing |
| Guardrails + path classification | Working, driven entirely by config (no hardcoded paths in code) |
| Backend API + SSE, UI (5 views → now Queue/Review/Metrics/Settings + sidebar detail) | Working, manually verified in browser |
| Real end-to-end attempt (plan → approve → implement → tests → PR) | **Never completed** — blocked on a credential the pilot project is expected to provide |
| Automatic PR opening | Not implemented |
| Cost/token tracking | Not implemented |
| Automatic ticket intake | Not implemented (manual queue file, intentional for now) |
| Hardcoded assumptions about the first project (language, framework, test runner, business domain names) | Present in several places — see Workstream 1 |
| Separation between "operator process notes" and "shippable config/docs" | Not yet done — currently mixed together |

## Guiding Principle for Generalization

Do not abstract ahead of evidence. The temptation is to build a plugin system for version-control providers, ticket trackers, and test runners *now*, while there is still only one real project to learn from. That produces an abstraction shaped by guesswork, which is usually wrong and has to be reworked anyway once a second real project shows up.

So: **generalize what's cheap and obviously correct immediately (Workstream 1). Defer what requires guessing another project's shape until a second real instance actually exists (Workstream 4) — that's the trigger, not a calendar date.**

## Workstreams

Ordered by priority. Workstreams marked "parallel" don't block or get blocked by the sequential ones.

### Workstream 1 — Remove first-project hardcoding, separate process notes from shippable content
**Priority: now, first.** Cheap, low-risk, and every day it's not done is a day new code might casually reintroduce the same hardcoding.

- Audit and remove hardcoded first-project assumptions from source: agent prompt context (currently states the target repo's language/framework/test tooling by name and asserts whose product it is), UI/dashboard titles, CLI messages that name the project directly.
- Confirm the config file already carries everything project-specific (blocklist paths, domain names, repo path, base branch) — it mostly does; verify nothing slipped into code instead.
- Separate operator-only working notes (engagement context, meeting notes, internal strategy, staff names, anything that is *about doing the work* rather than *part of the tool*) from what would ship with a delivered instance. These must not live anywhere that gets cloned out with an instance.
- Rewrite the top-level project guide (currently `CLAUDE.md`) to contain only generic, tool-level engineering rules that apply to any instance — no project-specific facts, no operator-process facts.
- **Done when:** a fresh reader of the shippable repo content sees zero references to any specific organization's identity, staff, or business relationship — only generic engineering rules plus that project's own config.

### Workstream 2 — Carry the first pilot to a real result
**Priority: highest ongoing.** This is not "a side project running in parallel" — it is the evidence the entire multi-project thesis depends on. Nothing about "this works for other projects" is arguable without a first completed case.

- Resolve the blocking dependency preventing the implementation phase from running (a credential the pilot project is expected to provide).
- Resolve who reviews on the project side and how much time per week — the real throughput ceiling, unresolved since the start.
- Get at least one ticket through the full pipeline: plan → approval → implementation → tests → (see Workstream 3) opened PR → human review outcome recorded.
- Keep pilot-specific decisions (which domains are off-limits, lane rules, etc.) exactly as they are — this workstream is about *running* the existing design, not changing it.
- **Done when:** at least one ticket has a recorded outcome with `humanEditedLines`, `reviewRounds`, and `merged` filled in — the three fields that make the autonomy-rate metric real instead of empty.

### Workstream 3 — Automatic PR opening, cost/token tracking
**Priority: high, right after / alongside Workstream 2.** Build these concretely against the current project's actual version-control provider — don't invent an abstraction layer for a second provider that doesn't exist yet. This becomes the informed first example when Workstream 4's VCS abstraction is eventually built.

- Automatic PR opening once implementation succeeds and tests pass, using the current project's provider API directly.
- Cost/token tracking summarized from the transcript data that already exists but isn't surfaced.
- **Done when:** a successful run opens a real PR without manual steps, and cost/token numbers appear in the metrics view.

### Workstream 4 — Deferred abstractions (triggered by a second real project, not by schedule)
**Priority: backlog. Do not start until the trigger condition is met.**

- Version-control / PR-provider abstraction (today: none exists; only one provider has ever been touched).
- Test-runner abstraction (today: the run command is already templated via config, but internal naming still assumes one specific test framework — rename once a second framework is a real case, not a guess).
- Ticket-intake abstraction (today: manual queue file shaped like one specific ticket tracker's export).
- **Trigger to start:** a second real project's instance is actually being set up. Not "we think there might be one soon."
- **Done when:** the same orchestrator codebase runs for two projects with genuinely different VCS/test-runner/ticket-tracker combinations, with no code changes between them — config only.

### Workstream 5 — AI readiness feature (parallel track)
**Priority: whenever there's room; does not block anything else.**

- Placeholder only. Earlier scaffolding for this (config fields, types) was removed from the codebase because it was started without a design and wasn't wired to anything. When this is picked up, it goes through the normal brainstorm → spec → plan cycle from scratch.
- **Done when:** N/A — not yet designed.

## What We're Explicitly Not Doing

- **Not building multi-project serving.** One process, one project's repo, at a time. No per-project routing, no shared queue across projects.
- **Not guessing a second project's shape to build abstractions early.** Workstream 4 waits for a real trigger.
- **Not keeping a shared multi-project config folder inside one repo.** Each instance is its own clone with its own single config — there is never a repo that holds more than one project's config at once.
- **Not touching the pilot's existing guardrail design** (blocklist, lane rules, two-stage plan/approve/implement flow) as part of this generalization work — Workstream 1 removes hardcoded *identity* facts, not the mechanism itself.

## Open Questions (not blocking, revisit later)

- Exact mechanics of separating operator process notes from shippable files (which folder, gitignore vs. history rewrite, etc.) — an implementation detail to resolve when Workstream 1 is actually executed, not a roadmap-level decision.
- Whether the top-level project guide should be one file or split further as more instances accumulate lessons — revisit after the second project's instance exists.

## How This Gets Used

Each workstream, when its turn comes, goes through: brainstorming → design doc in this folder → self-review → `writing-plans` → implementation. This roadmap is the map; it is not itself an implementation plan for any one workstream.
