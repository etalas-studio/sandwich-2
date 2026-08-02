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

## Explicitly Deferred (not designed against yet)

- Automatic ticket intake from a tracker (Jira/Linear/GitHub Issues) — phase 1 is manual queue only.
- Two-way integration with ticket trackers (e.g. posting agent comments back to a ticket).
- Multi-project / multi-tenant serving from one instance.
- Parallel ticket execution within one project.
- Editable/injectable pipeline stages (methodology injection) — only the architectural separation of stages is required now, not the injection mechanism itself.
- Version-control/PR-provider abstraction, test-runner abstraction, ticket-tracker abstraction — build concretely against whatever's needed for the first real project; abstract only once a second real project's different tooling makes the shape of the abstraction obvious.

## Open Questions (not blocking phase 1, revisit later)

- Exact format of the phase-1 queue file — to be defined at implementation time.
- Whether/how the periodic readiness scan gets triggered (manual button vs. schedule vs. change-triggered) — not yet decided.
- What the categorized "needs human" reasons aggregate into over time (a dashboard, a report) — the data model for capturing them is set (categorized, not free text), but the aggregation view itself isn't designed yet.
