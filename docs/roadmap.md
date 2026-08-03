# Roadmap

Written 2 August 2026, restructured 3 August 2026 into a checklist. At-a-glance list of phases, each broken into the architecture pieces its spec defines — checked off once every plan covering that piece is fully merged. The *why* behind each piece stays in the spec (`docs/superpowers/specs/`) and its plan (`docs/superpowers/plans/`) — this doc only tracks *is it done*, it doesn't re-explain the reasoning. (See `CLAUDE.md` Working Rules for when these checkboxes get updated.)

## Phase 1 — Core loop (in progress)

Prove the judgment-and-execution loop end to end, on one project, with a human curating which tickets get attempted: periodic readiness scan → per-ticket agent-ready/needs-human judgment → autonomous PR opening (ceiling: PR only, no auto-merge) with a structured summary → human review capture (merge outcome, edit effort, review rounds).

Spec: `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`

Architecture pieces (mirrors the spec's Architecture section):

- [ ] Agent engine (Pi SDK) — the Claude Code CLI approach (headless `claude -p` + PTY toggle, `docs/superpowers/plans/2026-08-02-engine-invocation-layer.md`, `docs/superpowers/plans/2026-08-03-pty-engine-toggle.md`) is dropped; moving to a Pi-SDK-backed `EngineInvoker` (`ModelRuntime`/`AgentSession`, same credential store as `/integrations` — see `src/pipeline/db-credential-store.ts`) so scan/implement/verify use the connected provider instead of shelling out to a separate `claude` CLI auth. Not yet built.
- [x] Storage (embedded SQLite) — `docs/superpowers/plans/2026-08-03-storage-sqlite.md` (done)
- [ ] Agent execution (scoped shell access, one worktree per attempt) — partially done: one worktree per attempt and cwd-confined shell access for the Implement stage are built by the pipeline orchestrator (`docs/superpowers/plans/2026-08-03-pipeline-shape.md`) — sandboxing beyond cwd confinement remains unplanned
- [ ] Pipeline shape (Judge → Implement → Verify → Open PR) — partially done: Implement and Verify are built for real, Judge is stubbed to always agent-ready, and Open PR is out of scope (`docs/superpowers/plans/2026-08-03-pipeline-shape.md`) — real Judge logic and Open PR remain unplanned
- [ ] Codebase understanding (no persistent index, fresh read per ticket) — no plan yet
- [ ] Verify (exit-code only) — mostly done: the exit-code-only Verify stage is built and wired into the pipeline (`docs/superpowers/plans/2026-08-03-pipeline-shape.md`), but it reads its test command from the readiness scan, whose scan process doesn't exist yet — without one, Verify stops at needs-human/weak-verification
- [ ] VCS abstraction (GitHub and Bitbucket, both first-class) — no plan yet
- [ ] Ticket intake (manual JSON queue file) — no plan yet
- [ ] Visibility (web UI + SSE, incl. first-run project-folder setup + readiness overview) — partially done: static ticket list/board/detail UI is built (`docs/superpowers/plans/2026-08-03-visibility-ui-foundation.md`), plus a per-ticket run trigger, 4-second polling so a run's status visibly advances, and a run transcript view (no design doc for that work — see CHANGELOG's `[pipeline-run-trigger]` entries); SSE live updates, first-run folder setup, and the readiness overview are still unplanned
- [x] Auth (custom, single account) — `docs/superpowers/plans/2026-08-03-auth.md` (done); merging it also brought every pipeline/settings/tickets route built before Auth existed under the same session gate and CSRF/Host guard, since none of them had any auth on them previously
- [ ] Deployment (server-agnostic) — no plan yet

Next unplanned piece is whatever you pick from the unchecked list above — nothing is currently in progress.

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

When Phase 2 (or any later phase) actually starts, it goes through the same cycle Phase 1 did: brainstorming → design doc in `docs/superpowers/specs/` → self-review → `writing-plans` → implementation. This file gets a new section added at that point, structured the same way: one checkbox per architecture piece from that phase's spec, checked off when its plan(s) are fully done.
