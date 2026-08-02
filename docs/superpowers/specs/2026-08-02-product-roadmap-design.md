# Product Roadmap — Design

Written 2 August 2026.

## Why this document exists

The project paused mid-build to answer a question that had never been made explicit: **what is this, for whom, and in what order do we build it.** This document is the answer, written down so future implementation sessions (via `writing-plans`) have a fixed reference instead of re-litigating scope each time.

This is a **roadmap**, not a spec for a single feature. It exists one level above the individual design docs in this folder — each workstream below gets its own brainstorm → spec → plan cycle when its turn comes, using this document only to know what's next and why.

## What This Product Is

An orchestrator that runs a coding agent per ticket in a separate git worktree, enforces guardrails, and records every attempt — for **any client's codebase**, not one specific codebase.

**Operating model: single-tenant per deployment.** One running instance always serves exactly one client's repository. Switching to a different client means swapping the config folder, not changing code. There is no multi-client server, no per-tenant routing, no shared instance serving several repos at once — that's explicitly out of scope (see "Not Doing" below).

**Each deployment is handed over to its client in full.** The client that commissions an instance receives the whole clone — source code, config, the works. This has one hard consequence for how the codebase must be structured: **anything that is the operator's own working process (not part of the tool itself) must never live in a file that ships with the handover.** Conversely, anything that describes the specific client's codebase (which paths are off-limits, what language/test framework they use, business context for prompts) belongs in that client's own config — it's fine for that to be specific, because it only ever lives in that client's own copy.

**The first real deployment is already in progress** (an active pilot, mid-way through). It is not a demo for this roadmap — it is the one dataset this whole roadmap depends on. If it produces no usable numbers, there is no case for building a second deployment at all.

## Current State (as of this writing)

| Area | Status |
|---|---|
| Two-stage orchestrator (plan → approve → implement) | Working, typecheck clean, 38 self-tests passing |
| Guardrails + path classification | Working, driven entirely by config (no hardcoded paths in code) |
| Backend API + SSE, UI (5 views → now Queue/Review/Metrics/Settings + sidebar detail) | Working, manually verified in browser |
| Real end-to-end attempt (plan → approve → implement → tests → PR) | **Never completed** — blocked on a client-side credential the pilot is waiting on |
| Automatic PR opening | Not implemented |
| Cost/token tracking | Not implemented |
| Automatic ticket intake | Not implemented (manual queue file, intentional for now) |
| Hardcoded assumptions about the first client (language, framework, test runner, business domain names) | Present in several places — see Workstream 1 |
| Separation between "operator process notes" and "shippable config/docs" | Not yet done — currently mixed together |

## Guiding Principle for Generalization

Do not abstract ahead of evidence. The temptation is to build a plugin system for version-control providers, ticket trackers, and test runners *now*, while there is still only one real client to learn from. That produces an abstraction shaped by guesswork, which is usually wrong and has to be reworked anyway once a second real case shows up.

So: **generalize what's cheap and obviously correct immediately (Workstream 1). Defer what requires guessing another client's shape until a second real deployment actually exists (Workstream 4) — that's the trigger, not a calendar date.**

## Workstreams

Ordered by priority. Workstreams marked "parallel" don't block or get blocked by the sequential ones.

### Workstream 1 — Remove first-client hardcoding, separate process notes from shippable content
**Priority: now, first.** Cheap, low-risk, and every day it's not done is a day new code might casually reintroduce the same hardcoding.

- Audit and remove hardcoded first-client assumptions from source: agent prompt context (currently states the target repo's language/framework/test tooling by name and asserts whose product it is), UI/dashboard titles, CLI messages that name the client directly.
- Confirm the config file already carries everything client-specific (blocklist paths, domain names, repo path, base branch) — it mostly does; verify nothing slipped into code instead.
- Separate operator-only working notes (engagement context, meeting notes, internal strategy, staff names, anything that is *about doing the work* rather than *part of the tool*) from what would ship in a handover. These must not live anywhere that gets cloned out with a deployment.
- Rewrite the top-level project guide (currently `CLAUDE.md`) to contain only generic, tool-level engineering rules that apply to any deployment — no client-specific facts, no operator-process facts.
- **Done when:** a fresh reader of the shippable repo content sees zero references to any specific client's identity, staff, or business relationship — only generic engineering rules plus that deployment's own config.

### Workstream 2 — Carry the first pilot to a real result
**Priority: highest ongoing.** This is not "a client's project running on the side" — it is the evidence the entire multi-client thesis depends on. Nothing about "this works for other clients" is arguable without a first completed case.

- Resolve the blocking dependency preventing the implementation phase from running (a credential currently owed by the client).
- Resolve who reviews on the client's side and how much time per week — the real throughput ceiling, unresolved since the start.
- Get at least one ticket through the full pipeline: plan → approval → implementation → tests → (see Workstream 3) opened PR → human review outcome recorded.
- Keep pilot-specific decisions (which domains are off-limits, lane rules, etc.) exactly as they are — this workstream is about *running* the existing design, not changing it.
- **Done when:** at least one ticket has a recorded outcome with `humanEditedLines`, `reviewRounds`, and `merged` filled in — the three fields that make the autonomy-rate metric real instead of empty.

### Workstream 3 — Automatic PR opening, cost/token tracking
**Priority: high, right after / alongside Workstream 2.** Build these concretely against the current client's actual version-control provider — don't invent an abstraction layer for a second provider that doesn't exist yet. This becomes the informed first example when Workstream 4's VCS abstraction is eventually built.

- Automatic PR opening once implementation succeeds and tests pass, using the current client's provider API directly.
- Cost/token tracking summarized from the transcript data that already exists but isn't surfaced.
- **Done when:** a successful run opens a real PR without manual steps, and cost/token numbers appear in the metrics view.

### Workstream 4 — Deferred abstractions (triggered by a second real client, not by schedule)
**Priority: backlog. Do not start until the trigger condition is met.**

- Version-control / PR-provider abstraction (today: none exists; only one provider has ever been touched).
- Test-runner abstraction (today: the run command is already templated via config, but internal naming still assumes one specific test framework — rename once a second framework is a real case, not a guess).
- Ticket-intake abstraction (today: manual queue file shaped like one specific ticket tracker's export).
- **Trigger to start:** a second real client deployment is actually being set up. Not "we think there might be one soon."
- **Done when:** the same orchestrator codebase runs against two clients with genuinely different VCS/test-runner/ticket-tracker combinations, with no code changes between them — config only.

### Workstream 5 — AI readiness feature (parallel track)
**Priority: whenever there's room; does not block anything else.**

- Placeholder only. Earlier scaffolding for this (config fields, types) was removed from the codebase because it was started without a design and wasn't wired to anything. When this is picked up, it goes through the normal brainstorm → spec → plan cycle from scratch.
- **Done when:** N/A — not yet designed.

## What We're Explicitly Not Doing

- **Not building multi-tenant serving.** One process, one client repo, at a time. No per-tenant routing, no shared queue across clients.
- **Not guessing a second client's shape to build abstractions early.** Workstream 4 waits for a real trigger.
- **Not keeping a shared multi-client config folder inside one repo.** Each deployment is its own clone with its own single config — there is never a repo that holds more than one client's config at once.
- **Not touching the pilot's existing guardrail design** (blocklist, lane rules, two-stage plan/approve/implement flow) as part of this generalization work — Workstream 1 removes hardcoded *identity* facts, not the mechanism itself.

## Open Questions (not blocking, revisit later)

- Exact mechanics of separating operator process notes from shippable files (which folder, gitignore vs. history rewrite, etc.) — an implementation detail to resolve when Workstream 1 is actually executed, not a roadmap-level decision.
- Whether the top-level project guide should be one file or split further as more deployments accumulate lessons — revisit after the second deployment exists.

## How This Gets Used

Each workstream, when its turn comes, goes through: brainstorming → design doc in this folder → self-review → `writing-plans` → implementation. This roadmap is the map; it is not itself an implementation plan for any one workstream.
