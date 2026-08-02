# Phase 1 Product Design

Written 2 August 2026. This is a from-scratch restart — no prior architecture was assumed as a given. Where this arrives at similar conclusions to a previous build, that's coincidence of good reasoning, not inheritance.

## Problem

Engineering teams increasingly work with AI coding harnesses (Claude Code, Cursor, etc.), but mistakes still happen, and human review remains a hard bottleneck — not agent throughput. Meanwhile, a large share of the work that lands in a team's task tracker (Jira, Linear, GitHub Issues, etc.) is small, low-risk, and doesn't need a human to actually perform the work — it needs a human to *decide* it's safe, and to *check* the result.

The goal of this product: **an AI agent orchestrator that autonomously handles the subset of tasks that don't require human involvement to perform — while making it clear, continuously, which tasks that is, and why.**

Two things make this hard in practice:
- Project context is often scattered across places the agent has no access to (Slack threads, tribal knowledge, meetings).
- Codebases vary wildly in how "AI-ready" they are — test coverage, verification gates, and danger zones differ by area, not just by project.

The product's differentiator isn't "it writes code" — plenty of tools do that. It's **judging, per task, whether it's safe to let the agent work autonomously, and being honest and specific when it isn't** — with the long-term aim of helping a codebase become more agent-ready over time, not just processing whatever comes in.

## Product Shape

**Single-tenant per instance.** One running instance always serves exactly one project's codebase. An organization with multiple projects runs multiple instances, one per project. There is no multi-project server, no per-project routing, no shared instance serving several codebases at once.

**Phase 1 scope is deliberately narrow**: prove the core judgment-and-execution loop end to end, on one project, with a human curating which tickets get attempted. Everything else (automatic ticket intake, multi-project support, plan-injection into the pipeline, parallel execution) is explicitly deferred, not designed around yet.

## The Core Loop

### 1. Upfront readiness scan (periodic, not per-ticket)

A lightweight, mostly mechanical pass over the codebase, run once initially and refreshed periodically (not on every ticket — an on-demand or scheduled operation). It produces two things:

- **A coarse readiness map**: tech stack, test command, and per-area signals (test-to-code ratio, churn/stability from version history) that inform — but don't replace — per-ticket judgment.
- **An agent-proposed blocklist**: paths *and* prohibited actions (e.g. "never run migrations," "never touch auth logic," not just directory names) that the agent identifies as high-risk while scanning. A human reviews this list and can add to it or remove entries from it — the agent proposes, the human has final authority.

This scan is deliberately cheap and structural, not a deep line-by-line audit of every file — that would be too expensive and go stale immediately. The real judgment happens per-ticket, informed by this map.

### 2. Ticket intake

Phase 1 uses a manually curated backlog (a queue file, format to be defined when this is implemented) — no automatic pull from any ticket tracker. A human selects which tickets to run via checkbox; there is no "run everything" action.

### 3. Per-ticket judgment: agent-ready or needs-human

For each selected ticket, the agent reads the ticket and the relevant slice of code, cross-references the readiness map and blocklist, and decides one of two outcomes.

**If agent-ready:**
- The agent proceeds straight to writing code. **No plan-approval gate** — the readiness judgment itself is the gate. Adding a second human checkpoint before code would just move the bottleneck earlier without adding value, since the whole point of the judgment is to identify tickets where that checkpoint is unnecessary.
- **One attempt only.** No automatic retry. If the attempt fails (tests fail, agent gets stuck, etc.), it becomes a needs-human outcome with a reason — not a silent retry. This preserves the signal that the attempt struggled, which matters for judging whether "agent-ready" calls are actually trustworthy over time. A human can manually re-queue the same ticket later.
- **Ceiling: opening a ready-to-review PR is the maximum the agent can do.** No auto-merge, no autonomous decision to consider something "done" beyond opening the PR.
- If, mid-attempt, the agent discovers it needs an environment variable/credential it doesn't have, that becomes a surfaced blocker (see "Credentials" below) rather than a silent failure.
- On success, the agent pushes its branch and opens the PR itself (using its own VCS credentials), including a **structured PR summary**: what it understood the ticket to ask for, the approach taken (and alternatives considered, if relevant), what files changed and what tests ran (with results), and anything it noticed but deliberately left alone. This summary appears **both** on the PR itself and in this product's own UI — so a reviewer can triage from either place.

**If needs-human** (whether judged upfront, or because the single attempt failed):
- No implementation plan is generated — that would spend tokens on a ticket that isn't going to be worked autonomously.
- The agent produces a **categorized reason**, not just free text. Initial categories: *ambiguous ticket* (underspecified or self-contradictory), *forbidden path/action* (blocklist hit), *weak verification* (low test coverage or no meaningful gate in the relevant area), *missing context* (requires business/tribal knowledge the agent has no access to).
- This reason is surfaced in-system. There is no two-way integration with the ticket tracker (e.g. posting comments back to Jira) in phase 1 — that idea is explicitly deferred, since it would only help one of the four categories (ambiguous ticket) and the rest need a human to act on the codebase or the policy, not answer a question.
- Categorization matters beyond the single ticket: aggregated over time, it's the concrete diagnostic for "what's actually holding this codebase back from being more agent-ready" — not just a pass/fail flag.

### 4. Review capture

When a human reviews an opened PR, they record three things in-system:
- **Merge outcome** — merged or not.
- **Edit effort** — a rough scale (merged as-is / minor edits / major edits before merging), not exact line counts.
- **Review rounds** — how many back-and-forths it took.

This is the feedback loop that eventually lets "is our agent-ready judgment actually correct, and improving" be answered with data, not impression.

### 5. Credentials

No upfront environment setup is required from the user. If the agent discovers mid-attempt that the codebase or its test suite needs an environment variable/credential it doesn't have, it surfaces that as a blocker in the UI (**"agent needs `X` to proceed"**). A human decides, per variable, whether to provide it through a UI form — not by editing a config file directly. Once provided, it's stored for that project instance and reused automatically for future tickets that need it; the same question is never asked twice. The decision of what to expose to the agent is entirely the human's, made as the actual need arises — not pre-emptively granted or withheld by the system.

### 6. Execution model

- **One git worktree per attempt** — isolates the agent's working files from the human's own checkout; trivially discarded if an attempt is abandoned.
- **Sequential execution** — one ticket attempt at a time, for the whole project instance. Chosen because: shared test infrastructure (databases, ports, fixtures) is much harder to isolate under parallel execution; sequential keeps the phase-1 visibility UI simple (one stream of "what's happening now" instead of N interleaved ones); failures are easier to diagnose with exactly one thing running; and the actual stated bottleneck (human review capacity) isn't relieved by agent-side parallelism anyway.

### 7. Visibility

Phase 1 requires **real-time, read-only visibility** into the pipeline as a run progresses — not an editable or injectable pipeline yet, just clear observability of what stage a run is in and what's happening at each stage. This has an architectural consequence: the pipeline's stages must be explicit and clearly separated in the implementation (not buried inside one large prompt/function), so that a future phase can inject new methodology into specific stages without a rewrite. Phase 1 does not build that injection capability — only the visibility, and an architecture that doesn't foreclose it.

## Architecture

Decided in a follow-up architecture-focused session, after the product-behavior design above was settled. These are technical/implementation decisions, not product-behavior ones.

### Agent engine: switchable, not fixed

Two supported engines from day one: **Pi SDK** (used for development) and **Claude SDK** (used in production). Switchable per-run, not fixed once at instance setup — the orchestrator defines a common engine interface, with each SDK as an implementation behind it. Research into each SDK's actual API/output format is an implementation-time task, not resolved here.

**PoC completed — both modes work, headless implemented first, PTY added as a toggle.** Two ways to invoke Claude Code exist, discovered while comparing against a third-party tool (Orca) that runs multiple coding-agent CLIs:

- **Headless (`claude -p`, non-interactive)** — structured JSON output per line, no terminal emulation needed. **This is the default.**
- **Interactive (real PTY session)** — spawns Claude Code as if a human were sitting at a terminal, driving it via simulated keypresses (trust dialog, permission dialogs). More engineering work: needs a pseudo-terminal, ANSI/dialog-state handling, no clean structured output to parse. **Available as an explicit opt-in.**

A throwaway PoC (see `poc/README.md` in the codebase) tested both against the real Claude Code CLI: 3/3 reliability for PTY, 2/2 for headless — both work. Headless was faster (10–16s vs 18–20s) and produces clean output with no ANSI-stripping needed, so it shipped first as the default, and does not require the PTY complexity to be built before anything can run.

**Why PTY exists as a toggle rather than being dropped:** Anthropic announced (14 May 2026) a split where headless/Agent-SDK usage on subscription plans would draw from a separate, smaller, non-rolling-over monthly credit once exhausted, billed at full API rates — while interactive terminal use stays on the normal subscription pool, unaffected, by definition. Anthropic **paused this split on its intended effective date** (15 June 2026) and hasn't said if/when it resumes. This orchestrator's actual usage pattern — repeated, unattended `claude -p` calls run continuously in the background — is precisely the pattern that split was aimed at, not a marginal edge case. Given that, cost durability was judged worth the added complexity for anyone who wants it now, without forcing the swap (and its dialog-handling/ANSI-parsing overhead) onto the default path that already works.

**Both modes satisfy the same `EngineInvoker` interface** — nothing that calls `EngineInvoker.run()` needs to know or care which mode is behind it. The choice is a per-instance (or per-run) configuration toggle, not an architectural fork.

### Storage: embedded SQLite

One SQLite file per instance. No external database service (ruled out Postgres/Neon deliberately — see reasoning below) and no NoSQL (the data is inherently relational: tickets → runs → reviews, and the whole point of capturing categorized "needs-human" reasons is to later aggregate/query them, which relational storage does naturally and document stores make awkward).

Rejected a shared/hosted Postgres (e.g. one Neon database for all projects) explicitly because it reintroduces multi-tenancy at the data layer even if the orchestrator process is still one-per-project — contradicts single-tenant-per-instance, and undermines "handed over in full" (a project can't cleanly take sole ownership of data that's pooled with others). Embedded SQLite means zero setup step and the instance's data is genuinely self-contained.

Config split: **static setup** (engine choice, VCS provider + credentials, repo path, blocklist) lives in a config file, human-edited. **Dynamically discovered credentials** (see Credentials, above) are stored in the SQLite database, provided through the UI — not hand-edited, since they accumulate over time as tickets surface new requirements.

### Agent execution: scoped shell access

The agent gets real shell access while working inside its git worktree (not a fixed allowlist of specific actions) — confined to that worktree's directory. Every command it runs is logged as part of the run's transcript (needed anyway for visibility). The blocklist (paths and prohibited actions, from the readiness scan) is the actual safety mechanism, not a restricted action-set — a fixed allowlist would be more provably safe but too brittle in practice, causing tickets to hit "needs human" for the wrong reason (an unanticipated command) rather than genuine risk. The worktree + PR-only ceiling + blocklist together are considered sufficient; shell access itself isn't treated as the primary risk surface.

### Pipeline shape: fixed linear sequence

Per ticket, in order:

1. **Judge** — read ticket + relevant code, cross-reference readiness map/blocklist → outcome: agent-ready or needs-human
2. **Implement** *(only if agent-ready)* — write code, using scoped shell access
3. **Verify** *(only if agent-ready)* — run the test command, check exit code only (see Verify below)
4. **Open PR** *(only if verify passed)* — push branch, open PR with structured summary

No separate plan-approval stage between Judge and Implement — reaffirms the earlier product decision that a human checkpoint there would recreate the bottleneck the readiness judgment is meant to remove. Any internal "think before acting" the agent does is part of how Implement (or Judge) works internally, not a visible/separate pipeline stage.

**Needs-human is a labeled outcome, not a 5th pipeline stage.** It attaches to whichever stage produced it (Judge deciding upfront, or Verify failing) with its category and reason shown there — avoids treating "stopped here" as visually different depending on which stage stopped it.

The readiness scan is a separate, periodic, non-per-ticket process — not part of this per-ticket sequence — but gets the same live-visibility treatment (see Visibility).

### Codebase understanding: no persistent index

Only the readiness scan's coarse output (tech stack, test command, per-area coverage/churn signals, blocklist) is reused across tickets. Judge and Implement read the actual relevant code fresh, every time, per ticket — no caching or persistent code index. Reasoning: code changes constantly, so a cached deep understanding risks going stale and having the agent act on wrong information while writing code that ships; the cost of that is worse than the cost of re-reading. A real persistent code index (embeddings, dependency graphs) that stays correctly in sync is a hard, ongoing problem — its own feature, not a phase-1 aside.

### Verify: exit-code only

The test command's exit code (0 = pass, non-zero = fail) is the only signal used — no framework-specific output parsing (e.g. no RSpec/Jest-specific structured result parsing). This is universal across any test runner in any language, consistent with deferring test-runner abstraction until a second real project's different tooling is actually in front of us. Raw test output is still captured in the run's transcript for anyone who wants the detail; it's just not pre-parsed into structured pass/fail counts for phase 1.

### VCS: GitHub and Bitbucket, both first-class

Unlike test-runner/ticket-tracker abstractions (deferred until a second real project appears), VCS abstraction is built **now**, deliberately breaking the "don't abstract ahead of evidence" default — because two concrete, known providers already exist today (GitHub for development, Bitbucket for production), not a hypothetical future one. A common VCS-provider interface (create branch, push, open PR, set PR description) with two real implementations, chosen per instance via config. Both are equally first-class — neither is a dev-only shim.

### Ticket intake: manual JSON queue file

No ticket-tracker abstraction — there's no live tracker integration to abstract in phase 1. The queue file itself is generic (ticket key, summary, description, optional URL), not modeled on any specific tracker's export format. Exact schema to be finalized at implementation time.

### Visibility: web UI + SSE

Real-time web UI, using Server-Sent Events (one-directional server-to-browser push) — sufficient since the browser only needs to *receive* live updates, not send real-time data back. Same live-progress treatment applies to both per-ticket runs and the readiness scan.

### Auth: custom, single account in phase 1

Custom auth (username, email, password) — not an external OAuth provider — chosen deliberately despite the extra responsibility (password storage/hashing, sessions) it puts on this instance, to keep the instance genuinely self-contained/dependency-free, consistent with "handed over in full." **Phase 1 is single-account** (one fixed credential pair per instance — a lock on the door, not a user-management system). Multi-account support (several people, each with their own login, on the same instance) is explicitly deferred to phase 2.

### Deployment: server-agnostic

The instance must run identically whether hosted locally or on a VPS — no assumption baked in about where it's deployed. Bind address is configurable (localhost for pure local use; a real address for VPS use) — login is the actual security boundary now that it exists, not network binding. The instance speaks plain HTTP only; TLS/HTTPS is the deploying party's responsibility (e.g. a reverse proxy in front of it), not something built into the instance itself.

## Explicitly Deferred (not designed against yet)

- Automatic ticket intake from a tracker (Jira/Linear/GitHub Issues) — phase 1 is manual queue only.
- Two-way integration with ticket trackers (e.g. posting agent comments back to a ticket).
- Multi-project / multi-tenant serving from one instance.
- Parallel ticket execution within one project.
- Editable/injectable pipeline stages (methodology injection) — only the architectural separation of stages is required now, not the injection mechanism itself.
- Test-runner abstraction, ticket-tracker abstraction — build concretely against whatever's needed for the first real project; abstract only once a second real project's different tooling makes the shape of the abstraction obvious. (VCS abstraction is the one exception — built now, since two real providers already exist; see Architecture.)
- Multi-account authentication / user management — phase 1 is single fixed credential pair; deferred to phase 2.

## Open Questions (not blocking phase 1, revisit later)

- Exact format of the phase-1 queue file — to be defined at implementation time.
- Whether/how the periodic readiness scan gets triggered (manual button vs. schedule vs. change-triggered) — not yet decided.
- What the categorized "needs human" reasons aggregate into over time (a dashboard, a report) — the data model for capturing them is set (categorized, not free text), but the aggregation view itself isn't designed yet.
- Which Pi SDK / Claude SDK specifics (auth, output format, tool-use capabilities) — research task at implementation time.
- Exact GitHub/Bitbucket API scopes and auth mechanics for the VCS interface — research task at implementation time.
- **Resolved:** the engine-invocation PoC ran (see Agent Engine section above and `poc/README.md`) — both headless and PTY invocation work reliably. Headless shipped as the default; PTY invocation as an explicit opt-in toggle is a separate, later implementation task (not yet built as of this writing — only the `EngineInvoker` interface and the headless `ClaudeCodeInvoker` exist so far).
