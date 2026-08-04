# Roadmap

Written 2 August 2026, restructured 3 August 2026 into a checklist, refreshed 4 August 2026 against what's actually merged. At-a-glance list of phases, each broken into the architecture pieces its spec defines — checked off once every plan covering that piece is fully merged. The *why* behind each piece stays in the spec (`docs/superpowers/specs/`) and its plan (`docs/superpowers/plans/`) — this doc only tracks *is it done*, it doesn't re-explain the reasoning. (See `CLAUDE.md` Working Rules for when these checkboxes get updated.)

## Phase 1 — Core loop (in progress)

Prove the judgment-and-execution loop end to end, on one project, with a human curating which tickets get attempted: periodic readiness scan → per-ticket agent-ready/needs-human judgment → autonomous PR opening (ceiling: PR only, no auto-merge) with a structured summary → human review capture (merge outcome, edit effort, review rounds).

Spec: `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`

Architecture pieces (mirrors the spec's Architecture section):

- [x] Agent engine (Pi SDK) — `ModelRuntime`/`createAgentSession` (`@earendil-works/pi-coding-agent`) backs both the ticket pipeline and the readiness scan's agent pass, sharing the same DB credential store as `/integrations` (`src/pipeline/db-credential-store.ts`, `src/pipeline/integrations.ts`). Built-in providers: OpenCode Go, Anthropic (API key), OpenAI Codex (OAuth). The earlier Claude Code CLI approach (`src/engine/`, headless + PTY) is dead code — nothing outside its own tests imports it.
- [x] Storage (embedded SQLite) — `docs/superpowers/plans/2026-08-03-storage-sqlite.md` (done); schema has grown since (readiness_scans, blocklist, tickets, Jira metadata columns — see `src/db/migrations/`)
- [x] Agent execution (scoped shell access, one worktree per attempt) — Implement creates a real `git worktree` per attempt (`src/pipeline/ticket-runner.ts`); the readiness scan's agent pass runs in its own throwaway worktree, removed when the scan ends. Shell/tool access is confined to the invoking worktree's cwd by the Pi SDK session; no sandboxing layer beyond that exists.
- [x] Pipeline shape (Judge → Implement → Verify → Open PR) — all four stages are real and wired (`src/pipeline/ticket-runner.ts`): Judge does a blocklist check plus a live AI relevance call (agent-ready / needs-human / bounded "quick win" clarifying choices); Implement and Verify invoke the agent for real. **Open PR is still fake** — it fabricates a `github.com/.../pull/fake-<id>` URL and tears down the worktree; no real VCS call happens. This is the one sub-piece still open under this checkbox.
- [ ] Codebase understanding (no persistent index, fresh read per ticket) — implicit today (each pipeline/scan invocation gets a fresh worktree, nothing is cached across runs) but never explicitly designed or documented as its own piece — no dedicated spec/plan
- [x] Verify (exit-code-adjacent, agent self-review) — Verify has the agent re-review its own diff and report `{ok, summary, warnings}` as JSON; a `false` `ok` becomes a needs-human `weak_verification` outcome, and warnings surface into `needsHumanReason` even on success. Diverged from the original "exit-code only" framing — no spec update yet reconciling that.
- [ ] VCS abstraction (GitHub and Bitbucket, both first-class) — project selection now goes through a real GitHub/Bitbucket abstraction (`docs/superpowers/specs/2026-08-04-project-selection-design.md`: OAuth connect → org/repo picker → server-side clone into a managed dir, `src/pipeline/vcs-github.ts`/`vcs-bitbucket.ts`, `src/routes/projects.ts`). **Open PR is still fake** — it fabricates a `github.com/.../pull/fake-<id>` URL and never commits/pushes; wiring Open PR through this same VCS abstraction is a separate not-yet-written spec.
- [x] Ticket intake (manual JSON queue file) — superseded by something better than the original plan: manual create/edit/delete via UI and API (`src/routes/tickets.ts`), plus a working Jira OAuth "Pull Tickets" import (`pullJiraTickets` in `src/pipeline/oauth-integrations.ts`) that maps real Jira issue fields (issue type, priority, sprint, story points, assignee, parent, attachments — `src/db/migrations/0007_jira_fields.ts`) onto tickets. Bitbucket OAuth connects (`src/routes/oauth.ts`) but has no pull-tickets equivalent yet — issues still need to come from Jira or manual entry.
- [x] Visibility (web UI, incl. first-run project setup + readiness overview) — ticket list/board/detail views, per-ticket run/stop/duplicate/delete, a live transcript view, and a readiness `ReadinessCard` on Overview (mechanical signals + agent-proposed recommendations, "Fix" button that turns a recommendation into a ticket) are all built and wired to real data. Status updates are 4-second polling, not SSE, for tickets; the ticket-run route additionally exposes an SSE stream (`GET /api/tickets/:key/stream`) that's used for quick-win resolve/rerun. Project setup is now the Settings > Project card's GitHub/Bitbucket connect-and-pick-repo flow (`src/routes/projects.ts`, `web/src/components/ProjectSection.tsx`), superseding the earlier manual local-path field — still not a first-launch wizard gate, functionally equivalent, differently shaped than the spec originally described.
- [x] Auth (custom, single account) — `docs/superpowers/plans/2026-08-03-auth.md` (done); scrypt password hashing (not bcrypt — correcting an earlier doc error), session cookies, Host/Origin CSRF guard, default-deny on all non-public `/api/*` routes, covering every route added since (scans, ticket-run, purge, settings/project)
- [ ] Deployment (server-agnostic) — no plan yet; runs as a single `node dist/web-server.js` process today, no containerization/deployment docs written

Remaining gaps under this phase, in rough priority order: real Open PR (VCS abstraction), Codebase understanding as its own documented piece, and Deployment. Everything else above is built and exercised by real (non-mocked) agent invocations when manually run.

## Phase 2 — Deferred from Phase 1 (not yet designed)

Items explicitly pushed out of Phase 1, to be designed properly (their own brainstorm → spec cycle) once Phase 1 is running and has produced real evidence to design against:

- Multi-account authentication / user management (Phase 1 is a single fixed credential pair).
- Two-way integration with ticket trackers (e.g. posting agent comments back to a ticket, or a Bitbucket pull-tickets equivalent to what Jira already has).
- Parallel ticket execution within one project.
- Editable/injectable pipeline stages (methodology injection into Judge/Implement/Verify/Open PR).
- Test-runner abstraction, ticket-tracker abstraction — triggered once a second real project's different tooling makes the shape obvious, not before.
- Multi-project / multi-tenant serving from one instance — currently ruled out entirely, would need to be deliberately reopened, not just added.
- Scheduled/periodic re-scanning (readiness scan is manual-trigger only today, by deliberate choice — see `docs/superpowers/specs/2026-08-04-readiness-scan-design.md`).

## How This Gets Used

When Phase 2 (or any later phase) actually starts, it goes through the same cycle Phase 1 did: brainstorming → design doc in `docs/superpowers/specs/` → self-review → `writing-plans` → implementation. This file gets a new section added at that point, structured the same way: one checkbox per architecture piece from that phase's spec, checked off when its plan(s) are fully done.
