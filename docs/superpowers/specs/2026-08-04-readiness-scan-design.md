# Readiness Scan Design

Written 4 August 2026. Builds the "Upfront readiness scan" step from `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`'s Core Loop, and the "Visibility... readiness overview" piece from `docs/roadmap.md`, which have been unplanned until now. Answers that spec's open question ("Whether/how the periodic readiness scan gets triggered") as: a manual button, triggered by a human from the Overview page.

## Why now, not just "nice to have"

`src/pipeline/verify.ts` already reads `getLatestReadinessScan(db)?.testCommand` and, finding none, always returns `needs_human: weak_verification` — every ticket run dead-ends there today. `src/db/readiness-scans.ts` and `src/db/blocklist.ts` (with its `proposedByScanId`/`source: 'agent'` fields) already exist, unused, waiting for a producer. This piece is the producer: it unblocks Verify and gives Overview something real to show, in one pass.

## Scope

One instance, one project (per the product design's single-tenant-per-instance rule) — there is no project picker. "Select project first" means: the scan button is gated on the same `repoPath` config Settings already collects via `fetchProjectSettings`/`ProjectSection`, not a multi-project chooser.

In scope: the scan process (mechanical signals + agent-proposed blocklist), its trigger route, and its display on Overview.
Out of scope: SSE (nothing in this codebase uses it yet; scan status is polled, same as ticket runs), a blocklist review UI (the existing Settings → Blocklist section already renders `source: 'agent'` entries — proposed entries just show up there with no new UI needed), and real Judge logic (still stubbed; wiring Judge to consult the scan's blocklist/signals is a separate follow-up).

## Backend

### Mechanical analysis (deterministic, no agent call)

New pure functions, given a `repoPath`:

- **Tech stack**: read `package.json` (name + dependency keys) and check for `tsconfig.json`. Reports a short comma-joined string built from what's actually present (e.g. presence of `typescript` → "TypeScript", `react` dep → "React", `express` dep → "Express"), falling back to "Node.js" alone if nothing more specific is detected. Not an exhaustive framework detector — coarse and mechanical, per the product spec's "lightweight, mostly mechanical" framing.
- **Test command**: `package.json`'s `scripts.test`, verbatim, or `null` if absent.
- **Per-area signals**: "areas" are the repo's top-level directories (excluding `node_modules`, `.git`, `dist`, `.work`, and other build/VCS directories). For each:
  - `testToCodeRatio` = count of test-like files (`*.test.*`, `*.spec.*`, anything under a `__tests__/` directory) ÷ count of all other code files in that area. `0` if the area has no code files.
  - `churnScore` = commit count touching that path prefix in the last 90 days (via `git log --since=... --name-only`, tallied by top-level prefix), normalized to `0`–`1` by dividing by the busiest area's raw count (`0` if no commits in the window at all).

This reuses the existing `AreaSignal`/`ReadinessScan` shapes in `src/db/readiness-scans.ts` as-is — no schema change.

### Agent pass (blocklist proposal)

Runs after the mechanical pass, inside a **throwaway worktree** — same `createWorktree`(`config.repoPath`, `config.worktreeRoot`, a `scan/`-prefixed branch, `config.baseBranch`) the ticket pipeline already uses, so the agent's shell access stays confined to a worktree exactly like every other agent invocation in this codebase, never the human's actual checkout. Removed via `removeWorktree(..., keepBranch: false)` once the scan ends — nothing from a scan is ever committed or kept.

Prompt: the mechanical signals above, plus an instruction to identify paths and prohibited actions too risky for autonomous agent work, answering **only** with a JSON array as its final message: `[{"pattern": string, "reason": string}, ...]`. The engine call goes through the same `EngineInvoker` interface Implement uses (via `createEngineInvoker(config.engineMode)`), so headless/PTY toggling and transcript capture come for free.

Parsing: extract the first JSON array substring from `finalText` and parse it. Each valid `{pattern, reason}` pair becomes an `insertBlocklistEntry(db, { pattern, reason, source: 'agent', proposedByScanId: scan.id })` call. If nothing parses (malformed output, or the agent returned prose instead of JSON), the scan still completes with its mechanical signals intact — zero blocklist entries are inserted and a warning is logged server-side. A scan is never failed solely because the blocklist-proposal step produced unusable output.

### Scan outcome

- `completed`: mechanical pass succeeded (agent pass may have contributed zero or more blocklist entries — that alone doesn't downgrade the status).
- `failed`: the *mechanical* pass threw (e.g. `repoPath` unreadable), or the agent engine call itself returned `timeout` / `process_error` / `nonzero_exit` / `aborted` — same outcome vocabulary style as the ticket pipeline stages. `readiness_scans` gets no new column for this; the failure reason is logged server-side (same level of detail the pipeline gives today for non-"needs-human" engine failures) — Overview just shows "scan failed, try again."

### Config

`PipelineConfig` (`src/pipeline/config.ts`) gains `scanTimeoutMs`, defaulting to 5 minutes (`DEFAULT_SCAN_TIMEOUT_MS`) — separate from `implementTimeoutMs`, since a scan is meant to be much cheaper than a real ticket attempt.

### Routes (`src/web-server.ts`)

- `POST /api/readiness-scans/run` — 503 if no `repoPath` configured (same check `POST /api/tickets/:key/run` already does via `resolveEffectiveConfig`); 409 if a scan or a ticket run is already in flight (reuses the existing single in-flight guard — a scan and a ticket run both need real shell access to the same repo via a worktree, so they share the same "only one thing running at a time" rule already enforced for ticket runs). Fire-and-forget, same pattern as the run route.
- `GET /api/readiness-scans/latest` — wraps `getLatestReadinessScan`. Returns `null` if none has ever run (distinct from a completed scan with empty signals).

## Frontend

### Overview page (`web/src/App.tsx`)

- On mount, fetches project settings (existing `fetchProjectSettings`) and the latest scan (`GET /api/readiness-scans/latest`), then polls the latter every 4s whenever a scan is in flight — same interval and pattern already used for ticket status polling.
- **No `repoPath` configured**: scan button rendered disabled, with the same "Not configured yet" wording `ProjectSection` uses, plus a text link to Settings.
- **`repoPath` configured, no scan yet**: a "First scan" button (visually matching the existing "Quick Add" button — gradient border, same padding/shadow).
- **Scan in flight**: button shows a "Scanning…" state, disabled.
- **Scan exists**: a new `ReadinessCard` component (`ds-card-outer`/`ds-card-inner`, consistent with `StatsCards`) showing tech stack, test command, and "scanned <relative time>," followed by a per-area table (path prefix, test-to-code ratio, churn score as a small bar like `StatsCards`' progress bar). The trigger button becomes "Re-scan."
- **Scan failed**: no card content change (last successful scan, if any, keeps showing) — the failure itself surfaces as a toast (see below), not a persistent banner.

### Error handling: toast instead of inline banner

Adds `sonner` as a new frontend dependency. A single `<Toaster />` mounted once in `App.tsx`'s root (alongside existing shell markup). Scoped to this feature only — the existing inline `runError` card for ticket run/stop/duplicate/delete errors is untouched. Readiness-scan errors (network failure calling the trigger route, and non-2xx responses — 409 already running, 503 not configured, or a scan that finished with `failed`) call `toast.error(message)` instead of writing to any inline state.

## Data flow summary

```
[Overview] --POST /api/readiness-scans/run--> [web-server]
                                                    |
                                        resolveEffectiveConfig (repoPath check)
                                        in-flight guard (shared with ticket runs)
                                                    |
                                          runReadinessScan (fire-and-forget)
                                                    |
                              mechanical analysis (tech stack, test command, area signals)
                                                    |
                                    startReadinessScan (status: running)
                                                    |
                                  createWorktree -> engine.run(blocklist prompt) -> removeWorktree
                                                    |
                              parse blocklist JSON -> insertBlocklistEntry (source: agent) x N
                                                    |
                                completeReadinessScan (status: completed | failed)

[Overview] --GET /api/readiness-scans/latest (polled while running)--> renders ReadinessCard
[Settings > Blocklist] renders newly inserted agent-proposed entries automatically, no new code
```

## Testing

- Mechanical analyzer: unit tests against fixture directory trees (fake `package.json`, fake nested dirs with test/non-test files, fake git history) — deterministic, no engine involved.
- Agent pass: unit tests using the existing fake `claude` binary, covering (a) valid JSON array → entries inserted with correct `proposedByScanId`, (b) prose/malformed output → scan still `completed`, zero entries, (c) each non-`ok` engine outcome → scan `failed`.
- Route tests: 503 when unconfigured, 409 when a ticket run or another scan is already in flight, 200 + `null` from `GET .../latest` before any scan has run.
- Manually clicking "First scan" in the running app is a real Claude Code invocation, same as clicking "Run" on a ticket already is today — not gated by `ALLOW_LIVE_CLAUDE_CHECK` (that guard is specific to `manual-check.ts`/`manual-check-pty.ts`, not the production pipeline path this reuses). Flagging per `CLAUDE.md`, not asking for a separate go-ahead beyond this plan's approval.

## Out of scope (explicitly deferred)

- Real Judge logic consulting the scan's blocklist/signals (still stubbed to always `agent_ready`).
- A UI for humans to edit/curate agent-proposed blocklist entries beyond what Settings already has (add/delete both already work there).
- Scheduled/periodic re-scanning (manual button only, per this spec's answer to the open question).
- SSE live updates (polling only, consistent with the rest of this codebase today).
