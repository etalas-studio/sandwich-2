# Pipeline Shape — Design Doc

Written 2026-08-03. Covers the "Pipeline shape" architecture piece from the Phase 1 spec (`docs/superpowers/specs/2026-08-02-phase-1-product-design.md`, "Pipeline shape: fixed linear sequence") — the per-ticket Judge → Implement → Verify → Open PR sequence. This doc scopes what actually gets built now versus what's deliberately deferred, given two things this piece depends on (Agent execution's scoped shell access, VCS abstraction) have no plan yet, and a third (the readiness scan) has storage but no scan process.

## Scope for this plan

This plan builds **Implement → Verify**, ending at a `ready_for_pr` outcome. It does **not** build Open PR — that stays fully out of scope until VCS abstraction gets its own spec/plan. It does **not** build a real Judge — see "Judge is stubbed" below.

Three deliberate deviations from the Phase 1 spec's Pipeline shape as originally written, each because a piece it depends on doesn't exist yet:

1. **Judge is stubbed to always return `agent_ready`.** The spec's Judge stage is supposed to cross-reference a readiness map and blocklist and produce a categorized judgment. But the readiness-scan process that produces that map doesn't exist yet — only its storage tables do. Building the real Judge now would mean judging every ticket against data that's either empty or hand-seeded, which isn't a meaningful judgment. Instead, `judge()` exists as its own function and is still called and persisted by the orchestrator (so swapping in real logic later touches only this one function), but it does no agent call and always returns ready. This is safe in practice because tickets are still human-selected into the queue by hand (existing Core Loop step 2) — this isn't opening execution to unreviewed tickets, just removing the upfront agent judgment layer. **Revisit once the readiness-scan piece is built.**
2. **Engine mode defaults to PTY, not headless.** The Phase 1 spec's Agent Engine section and a comment in `src/engine/create-invoker.ts` both describe headless as "the default across this project," chosen there for cost/speed reasons. This instance's config overrides that recommendation and defaults to PTY instead — the architecture explicitly supports this ("switchable per-run, not fixed"; `createEngineInvoker` takes an explicit mode, it never auto-selects). As part of this plan, the stale "headless is the default" wording in both places should be updated to describe it as the previously-recommended default rather than a fixed choice, so the docs don't contradict the actual config.
3. **Ticket intake is assumed, not built.** Pipeline shape takes a `ticketKey` and reads it via the existing `tickets.getTicketByKey` — how it got into the `tickets` table (queue file, manual insert, seed script) is entirely Ticket intake's problem, a separate unplanned piece.

## Architecture

New directory `src/pipeline/`:
- `types.ts` — shared `PipelineContext` and one result type per stage
- `judge.ts` — `judge(context): Promise<JudgeResult>` (stub, see above)
- `implement.ts` — `implement(context, judgeResult): Promise<ImplementResult>`
- `verify.ts` — `verify(context, implementResult): Promise<VerifyResult>`
- `run.ts` — `runPipeline(ticketKey, config, onProgress?)`, the orchestrator

This satisfies the Phase 1 spec's requirement that pipeline stages be "explicit and clearly separated in the implementation (not buried inside one large prompt/function)," so a future phase can inject methodology into one stage without touching the others.

**Worktree lifecycle:** one worktree, created once before Judge runs (reusing `git.ts`'s `assertCleanRepo`/`createWorktree`), reused across Judge → Implement → Verify. Not one per stage.

**Orchestrator flow:** each stage only runs if the previous one produced a "keep going" result. Judge (stub) always continues. Implement continues only if it committed changes. Verify is the last stage in this plan.

```
runPipeline(ticketKey):
  ticket = getTicketByKey(ticketKey)
  run = insertRun({ ticketKey, engine, outcome: "running", startedAt })
  worktree = createWorktree(...)

  j = judge(ctx)                     // stub: always agent_ready
  updateRun(run.id, { outcome: j.outcome, ... })
  if j.outcome !== "agent_ready": return

  i = implement(ctx, j)
  updateRun(run.id, { branch, worktreePath, baseCommit, outcome: i.outcome, ... })
  if i.outcome !== "changes_committed": return

  v = verify(ctx, i)
  updateRun(run.id, { outcome: v.outcome, ... })
```

## Stage details

**Judge** — stub only in this plan. Always returns `{ outcome: "agent_ready" }`. No agent call, no blocklist cross-check, no categorization.

**Implement** (only if Judge said `agent_ready`):
- Calls `EngineInvoker.run()` (from the existing `src/engine/` layer — this plan doesn't build agent invocation, it consumes the interface) in the worktree, cwd-confined shell access, no additional sandboxing.
- If the engine result's own `outcome !== "ok"` (timeout / process_error / nonzero_exit), stop with a matching pipeline outcome (`implement_timeout`, `implement_error`, `implement_nonzero_exit`), `needsHumanCategory: null`.
- Otherwise compute the diff via `git.ts`'s `summarizeDiff`, generalized to drop the RSpec-specific `addedTestFiles` detection (no longer meaningful now Verify is exit-code-only).
- Empty diff → stop, outcome `no_changes`, `needsHumanCategory: null`.
- **Deterministic blocklist check against the actual changed files** (`listBlocklistEntries`, prefix/glob match against the diff's file list) — this is the *only* blocklist enforcement while Judge is stubbed. A hit → stop, outcome `needs_human`, `needsHumanCategory: "forbidden_path_or_action"`, nothing committed or pushed.
- Otherwise commit all changes to the branch (`git.ts`'s `commitAll`) with a structured message. Outcome `changes_committed`, continue to Verify.

**Verify** (only if Implement committed):
- First checks `getLatestReadinessScan()?.testCommand`. If none exists, stop with outcome `needs_human`, `needsHumanCategory: "weak_verification"` — there's nothing to verify against, so nothing can be marked ready. (This check lives here rather than in Judge because Judge is stubbed in this plan; it's the one piece of the spec's "weak verification" safety property that still needs to hold.)
- Otherwise runs that test command as a plain child process in the worktree (`src/proc.ts`-style `exec`, **not** `EngineInvoker` — this is a shell command, not an agent call), exit code only, per the spec's "Verify: exit-code only" architecture decision.
- Exit 0 → outcome `ready_for_pr` (terminal success state for this plan, since Open PR is out of scope).
- Nonzero exit or timeout → outcome `verify_failed` (or `verify_timeout`), `needsHumanCategory: null`.

## Outcome model

The Phase 1 spec's four needs-human categories (`ambiguous_ticket`, `forbidden_path_or_action`, `weak_verification`, `missing_context`) are Judge's ticket-judgment vocabulary. They don't cleanly describe an attempt that simply failed partway (implement timeout, no changes, tests actually red) — none of the four honestly describes "tests came back red." So:

- `needsHumanCategory` is populated only for stops that map onto one of those four categories with a straight face. In this plan, with Judge stubbed, that means exactly two cases: Implement's diff-time blocklist hit (`forbidden_path_or_action`) and Verify's missing-test-command check (`weak_verification`) — both are really Judge's job, just relocated to whichever stage still needs to enforce them while Judge itself is a no-op.
- Attempt-level failures (engine timeouts/errors, `no_changes`, `verify_failed`) get `needsHumanCategory: null`, distinguished instead by a distinct `outcome` string, with `needsHumanReason` carrying a free-text explanation.
- Both axes mean the same thing in product terms — no PR opens, a human must look — they're just represented differently in the data, since only one axis has a fixed, meaningful vocabulary to draw from.

## Config

A new, minimal static config (e.g. `config/instance.json`), separate from the legacy `config/pipeline.json` — the existing `storage-sqlite` plan already established that `src/config.ts`/`Config` belongs to the prior attempt's pipeline and isn't the foundation this restart extends. Holds: `repoPath`, `worktreeRoot`, `branchPrefix`, `baseBranch`, `engineMode` (default `"pty"`).

## Worktree cleanup and error handling

Worktree is kept (never removed) whenever a run stops in a state a human needs to inspect — which in practice is every real code path in this plan: any `needs_human` outcome, any attempt-failure outcome, and `ready_for_pr` (a human still needs the code to exist to open that PR by hand, since Open PR is out of scope here).

Engine-level failures are checked at the top of each stage that calls `EngineInvoker` before doing anything else with the result.

No crash-resume logic. If the process dies mid-run, that `runs` row is left wherever it last got updated (or `"running"` if it never progressed). Consistent with the spec's "one attempt only... a human can manually re-queue" model, re-queuing a ticket creates a **new** `runs` row via `insertRun` — it never resumes an old one.

## Artifacts

New SQLite table `run_artifacts` (`run_id`, `kind`, `content`, `created_at`; kind ∈ `judge_prompt` / `judge_transcript` / `implement_transcript` / `diff_patch` / `verify_output`). Plain TEXT columns — no separate file-based artifact store, which avoids reintroducing the old `record.ts` file-per-run approach (and its path-traversal-guarded reader) that the SQLite architecture decision already moved away from. `judge_prompt`/`judge_transcript` won't actually be produced while Judge is stubbed, but the schema stays generic for when it isn't.

## What's reused from the prior attempt, and what isn't

Reused: `git.ts`'s `assertCleanRepo`, `createWorktree`, `removeWorktree`, `commitAll`, and `summarizeDiff` (generalized, dropping its RSpec-specific test-file detection) — these are generic and match the new spec's "one worktree per attempt" model.

Not reused: `orchestrator.ts` (encodes a Plan → human-approval-gate → Implement flow the new spec explicitly rejects), `guardrails.ts`/`rspec.ts` (post-hoc "lane" classification and RSpec-specific verification, both superseded by exit-code-only Verify and the diff-time blocklist check described above), `agent.ts`/`prompts.ts` (superseded by the new `src/engine/` `EngineInvoker` layer), `record.ts` (file-per-run storage, superseded by the SQLite architecture decision).

## Testing

Follows the convention already established by `src/engine/*.test.ts` and `src/db/*.test.ts`: hand-rolled `node:assert` tests, no framework, one `*.test.ts` per module with its own `main()`, run individually via `node dist/pipeline/<name>.test.js` after build — not wired into `npm run selftest`, matching how the engine/db tests already work.

- `judge.test.ts` — trivial, asserts the stub always returns `agent_ready`.
- `implement.test.ts` / `verify.test.ts` — use a fake `EngineInvoker` (in-memory, satisfies the interface) and a real throwaway git repo (`mkdtempSync` + `git init`), never mocking git itself. A real throwaway SQLite file (`mkdtempSync`/`tmpdir()`) backs the DB calls, following the same pattern `storage-sqlite`'s tests use.

## Explicitly not covered (deferred to future pieces)

- Open PR / VCS abstraction — this plan ends at `ready_for_pr`.
- Real Judge logic (agent-based judgment, categorization, upfront blocklist cross-check) — deferred until the readiness-scan piece exists to give it something real to judge against.
- Ticket intake (queue file parsing) — this plan assumes a ticket is already in the `tickets` table.
- Scoped shell access beyond cwd confinement — Implement gets real shell access confined only by the worktree's directory, no additional sandboxing layer (consistent with the Phase 1 spec's Agent execution section, which itself has no plan yet beyond this).
