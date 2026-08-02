# Roadmap

Written 2 August 2026. Short, at-a-glance list of phases. Each phase's real detail lives in its own spec (`docs/superpowers/specs/`) and, once planned, its own implementation plan (`docs/superpowers/plans/`) — this doc just orients; it isn't itself a spec.

## Phase 1 — Core loop (in progress)

Prove the judgment-and-execution loop end to end, on one project, with a human curating which tickets get attempted: periodic readiness scan → per-ticket agent-ready/needs-human judgment → autonomous PR opening (ceiling: PR only, no auto-merge) with a structured summary → human review capture (merge outcome, edit effort, review rounds). Single-tenant per instance. Switchable agent engine (Pi SDK for dev, Claude SDK for production). GitHub and Bitbucket both first-class as VCS providers. Manual JSON ticket queue. Custom auth, single account. Server-agnostic deployment (local or VPS).

Spec: `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`
Plan: not yet written.

## Phase 2 — Deferred from Phase 1 (not yet designed)

Items explicitly pushed out of Phase 1, to be designed properly (their own brainstorm → spec cycle) once Phase 1 is running and has produced real evidence to design against:

- Multi-account authentication / user management (Phase 1 is a single fixed credential pair).
- Automatic ticket intake from a tracker (Jira/Linear/GitHub Issues) — Phase 1 is manual queue only.
- Two-way integration with ticket trackers (e.g. posting agent comments back to a ticket).
- Parallel ticket execution within one project.
- Editable/injectable pipeline stages (methodology injection into Judge/Implement/Verify/Open PR).
- Test-runner abstraction, ticket-tracker abstraction — triggered once a second real project's different tooling makes the shape obvious, not before.
- Multi-project / multi-tenant serving from one instance — currently ruled out entirely, would need to be deliberately reopened, not just added.

## How This Gets Used

When Phase 2 (or any later phase) actually starts, it goes through the same cycle Phase 1 did: brainstorming → design doc in `docs/superpowers/specs/` → self-review → `writing-plans` → implementation. This file gets a new section added at that point, not rewritten.
