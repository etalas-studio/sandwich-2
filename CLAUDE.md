# CLAUDE.md — Project Context

Written 2 August 2026, rewritten 4 August 2026 once Phase 1's core loop was substantially built. What follows describes the app as it actually exists today, not the day-zero restart plan — see "History" below for that.

## What This Is

A single-tenant web app (Node.js `http` server + React/Vite frontend, embedded SQLite) that scans a codebase for AI-agent readiness and runs an autonomous Judge → Implement → Verify → Open PR pipeline against tickets a human curates. Full product framing lives in `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`; current build status lives in `docs/roadmap.md` — this file only orients, it doesn't track status.

## Where To Look

| Document | What it's for |
|---|---|
| `docs/roadmap.md` | Phase list + architecture checklist — status lives here, start here |
| `README.md` | User-facing: what it does, how to run it, API routes, DB schema, env vars |
| `docs/superpowers/specs/2026-08-02-phase-1-product-design.md` | Phase 1 product design: problem, core loop, architecture decisions |
| `docs/superpowers/specs/` | Per-piece design docs, one per named plan below |
| `docs/superpowers/plans/` | Implementation plans (task-by-task) matching each spec |
| `docs/design-system.html` | Visual design system — all UI components live here. Copy Tailwind classes directly. |
| `CHANGELOG.md` | One entry per completed implementation task |

## Architecture At A Glance

- **Engine**: agent invocation goes through the Pi SDK (`@earendil-works/pi-coding-agent`'s `ModelRuntime`/`createAgentSession`), not a shelled-out `claude` CLI. `src/pipeline/integrations.ts` owns the shared `ModelRuntime`, backed by the same DB-stored credential store (`src/pipeline/db-credential-store.ts`) used by `/integrations`. Built-in providers: OpenCode Go and Anthropic (API key), OpenAI Codex (OAuth/subscription).
- **`src/engine/` (Claude Code CLI invokers, headless + PTY) is dead code** — no route or pipeline file imports it anymore. It's kept only for its own tests/manual-check scripts as a reference for the approach that was replaced by the Pi SDK. Don't build on it; don't assume it's wired to anything.
- **Ticket pipeline** (`src/pipeline/ticket-runner.ts`): Judge → Implement → Verify → Open PR, all real (not stubbed). Judge does a blocklist substring check plus a live AI relevance call (can return `agentReady`, a block reason, or a bounded "quick win" clarifying-choice set). Implement creates a real `git worktree`, invokes the agent, TDD-flavored prompt. Verify has the agent self-review its own diff and report ok/warnings via JSON. Open PR is **still fake** — it fabricates a `github.com/.../pull/fake-<id>` URL and cleans up the worktree; no real VCS integration exists yet.
- **Readiness scan** (`src/scanner/`): mechanical pass (tech stack, test command, per-area test-to-code ratio and churn, all deterministic — no agent call) plus an agent pass run inside a throwaway worktree that proposes blocklist entries and area descriptions. Wired to a manual "Run scan" trigger from the Overview page, not scheduled.
- **HTTP layer**: hand-rolled `Router` (`src/router.ts`, trie-based, `:param` segments, middleware) plus one route module per domain under `src/routes/` (auth, settings, integrations, oauth, scans, tickets, ticket-run, purge). No Express, no framework.
- **Auth**: single-account, scrypt password hashing (not bcrypt), session cookies, Host/Origin CSRF guard, default-deny on all non-public `/api/*` paths.
- **Ticket intake**: manual creation via UI/API today, plus a working Jira OAuth "Pull Tickets" import (`pullJiraTickets`); Bitbucket OAuth connects but has no pull-tickets equivalent yet.
- **VCS abstraction**: not built. Open PR is fake regardless of which tracker a ticket came from.

## Working Rules

- Run `npm run build` and `npm run test` before and after any code change, to confirm nothing already-working broke.
- When a task from an implementation plan completes, append one line to `CHANGELOG.md` (format: `- YYYY-MM-DD: [plan-name] | @githubusername - what it delivered`) as part of that task's completion commit — don't batch it up for later.
- **IMPORTANT:** Status must never lag merged code. In the same commit that finishes a task: check off that task's checkbox in its plan file. In the same commit that finishes a plan's *last* task: flip that architecture piece's checkbox in `docs/roadmap.md` to done too.
- Work on a plan happens on a branch named after the plan (e.g. `engine-invocation-layer`), merged back once the plan's tasks are done.
- `node-pty` requires its native `spawn-helper` binary to actually be executable after install — check this first if PTY-mode invocation misbehaves right after a fresh `npm install`. (Note: this only matters if you're touching the now-unused `src/engine/` PTY invoker or its manual-check script — the live pipeline no longer depends on it.)
- **IMPORTANT — costs real tokens:** `src/engine/manual-check.ts` and `src/engine/manual-check-pty.ts` invoke the real Claude Code CLI directly (separate from the Pi SDK path the live pipeline uses). Never run either of them, or anything that shells out to them, without the human's explicit go-ahead in the current conversation. Both refuse to run unless `ALLOW_LIVE_CLAUDE_CHECK=1` is set — do not set that env var on the user's behalf to work around the guard. The live ticket pipeline and readiness scan (via the Pi SDK) are a *separate* real-token path not gated by that flag — see `docs/superpowers/specs/2026-08-04-readiness-scan-design.md`'s Testing section for what's expected to be a real invocation when manually exercised in the running app. (Everything under `npm run build`/`npm run test` is safe — it uses a fake `claude` binary / fake invoker and never touches the network.)

## History

The project paused once (2 August 2026) to restart its product direction from first principles rather than build on a single prior pilot's architecture as if it were already the answer. That prior attempt's docs and standalone CLI pipeline (`cli.ts`/`orchestrator.ts`/`prompts.ts` and everything only they depended on) were deleted, not archived — a `backup/pre-reset-2026-08-02` branch holds that history if it's ever needed. Everything described above was built fresh after that reset; none of it inherits from the deleted pilot.
