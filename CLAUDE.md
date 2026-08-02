# CLAUDE.md — Project Context

Read this first before changing anything. Written 31 July 2026.

---

## What This Project Is

An orchestrator that runs a coding agent per Jira ticket in a separate git worktree, enforces guardrails, and records every attempt.

**What's being built here isn't the AI.** The AI is Claude Code, already installed. What's being built is the layer around it: ticket intake, scope restriction, safety gates, measurement, and UI.

The target repo is at `../runchise` — a Rails monolith belonging to the client. **Never commit anything to that repo from here.**

## Engagement Context

- **Runchise** = client. Restaurant operations software product. Repo `RR` = Rails backend (Ruby 3.0.1, Rails 6.1) on Bitbucket. People: Daniel, Joshua, Paula.
- **Etalas** = vendor (us). Pandu, Dharma, Hanif.
- 3-week pilot, started 27 July 2026. Meeting notes in `docs/00-mulai-dari-sini.md`.
- Model: Claude subscription (that's why it **must** be Claude Code — subscription cannot be used via third-party tools). Amazon Bedrock API key to follow later.

## Pilot Thesis — Don't Divert Without Strong Reason

The Runchise team is **not slow**: 277 tickets completed in 90 days (~21.5/week), median 6 days, 10 contributors. What's expensive in their codebase is **understanding code before changing it, and ensuring correctness after changing it.**

So the focus is on **verification**, not code production. Increasing agent output on the production side only extends the queue at the review gate.

Hence the sequence: **agent writes characterization tests first, then changes code.** Coverage is the currency to buy passage through the human gate. Full explanation in `docs/02-desain-pipeline.md`.

## Current Status

| Component | Status |
|---|---|
| Two-stage orchestrator (plan → approve → implementation) | working, typecheck clean |
| Guardrails + path classification | working, 38 selftests passing |
| Backend API + SSE | working, all endpoints manually tested |
| UI 5 views (React + Vite, `web/src/`) | working; manually verified in browser for 5 tabs + run detail (status `error`); review form & approve/reject buttons not yet tested with real data — no run has reached `awaiting_plan_approval` or `ready_for_review` |
| Automatic PR opening | **not implemented** — needs Bitbucket credentials |
| Cost/token tracking | **not implemented** — data exists in transcript, not yet summarized |
| Automatic Jira intake | **not implemented** — `queue.json` is still manual, and that's intentional for pilot |
| Real end-to-end attempt | **never done** |

### Primary Blocker

`RAILS_MASTER_KEY` not yet received from Runchise. Without it, rspec cannot run, so the implementation phase cannot complete. The plan phase (`--plan-only`) **can** run now without it.

Another unresolved blocker since the beginning: **who is the reviewer on Runchise's side and how many hours per week.** That's the real throughput ceiling.

## Decisions Not To Change Without Thought

1. **Agent never pushes to `master`.** Always branch, always PR. No exceptions during pilot.
2. **Path 1 (no review before merge) is disabled** in `config/pipeline.json`. One selftest intentionally forces this to remain disabled. The asymmetry: auto-merge saves a few hours, one bug slipping through in the GL domain could end the pilot.
3. **Gates are determined from diff, not from ticket.** Before the agent works, we can only guess which files will be touched; once diff exists, we know.
4. **Plan is checked against the blocklist before a single line of code is touched.** The cheapest gate in the entire system.
5. **Orchestrator (root) has zero runtime dependencies.** Only `typescript` and `@types/node` as devDependency in root `package.json` — this is what touches the client repo, so the argument "we're not installing anything weird on your machines" holds precisely there. Frontend (`web/`) has its own `package.json` with React + Vite and a build step (`npm run build` from root triggers `vite build` in `web/`) — intentionally separated so anyone reading root `package.json` doesn't mistakenly think the agent-runner needs React. If adding dependencies to root, still think twice; `web/` may add frontend dependencies as long as the reason is clear and they stay in `web/package.json`, not root.
6. **`proc.ts` never uses shell.** Ticket text comes in as a complete argument, so ticket description contents cannot be executed as commands.
7. **Jobs run serially, one at a time.** Not because worktrees would conflict — they're separate — but because rspec competes for the same test database.
8. **Server only listens on `127.0.0.1`.** This UI can modify code in the client repo.
9. **`runs.jsonl` is append-only.** One attempt can have multiple lines; reading takes the last line per `ticket/runId`. Do not change to rewrite-in-place.

## Working Rules

- After changing `config/pipeline.json`, **run `npm run selftest`.** Incorrect guardrails are the most dangerous bug in this project, and they fail silently.
- After changing code, run `npm run build` before running `dist/cli.js`.
- `tsconfig.json` is intentionally strict (`noUncheckedIndexedAccess`, `strict`). Do not loosen it — this setting has caught real bugs (missing outcome label).
- Do not add a test framework. `selftest.ts` is sufficient and has no dependencies.
- If adding a new `Outcome` value, TypeScript will force completing `OUTCOME_LABEL` in `dashboard.ts` and should also be updated in `OUTCOME` in `web/index.html` (this one isn't compiler-enforced — easy to forget).

## Commands

```bash
npm install && npm run build
node dist/cli.js doctor      # check prerequisites, run this first
npm run selftest             # 38 guardrail checks
node dist/cli.js serve       # UI at http://127.0.0.1:4319
node dist/cli.js run --dry-run     # without invoking agent
node dist/cli.js run --plan-only   # agent invoked, code untouched
node dist/cli.js run --ticket RR-7338
```

## Structure

| Location | Contents |
|---|---|
| `src/orchestrator.ts` | Single attempt flow. **Read this first to understand the system.** |
| `src/guardrails.ts` | Blocklist, safety bounds, path classification. Most critical part |
| `src/prompts.ts` | Plan & implementation stage prompts |
| `src/server.ts`, `src/jobs.ts` | API, SSE, serial queue |
| `src/selftest.ts` | 38 checks, no dependencies |
| `config/pipeline.json` | The only file that needs regular editing. 41 blocklist paths |
| `queue.json` | Ticket queue, manual. Gitignored |
| `web/` | Frontend React + TypeScript + Vite. Separate `npm install` & `npm run build` from root |
| `runs/` | Attempt recordings. Gitignored |
| `docs/` | Analysis context and decisions |

## Documents

Read as needed, not all at once:

| Document | When to Read |
|---|---|
| `docs/00-mulai-dari-sini.md` | Orientation. Who's who, real Jira numbers, and early framing corrections |
| `docs/01-audit-codebase.md` | Before touching anything about the client repo. Structure, coverage per domain, dangerous files |
| `docs/02-desain-pipeline.md` | Reasons behind the flow and gates |
| `docs/03-metrik-dan-baseline.md` | Success definition, real baselines, stop criteria |
| `docs/04-primer-test-dan-runtime.md` | How to read tests in Runchise repo, and characterization test explanation |
| `docs/05-roadmap.md` | **Read this to know what we're building next and why.** Long-term product direction, workstreams, priority order |
| `README.md` | Usage, API, limitations |

## Key Numbers (Don't Reconstruct)

From Jira and repo, pulled 29–31 July 2026:

- 300 newest To Do tickets scored: Tier A 18, B 64, C 126, D 92
- Only **16 tickets** are both agent-ready **and** <120 days old. Three are accounting domain → fast path remaining: 13
- Tickets created in last 30 days: **4%** agent-ready (1 of 27). Tickets arrive in raw condition
- Team throughput: 277 completed / 90 days. Created: 324 / 90 days
- Median cycle time 6 days; p90 134 days; record 670 days
- Metadata: 1 ticket has label, **0** have component, **0** have priority other than Medium
- Codebase: 4,446 `.rb` files in `app/`, 1,658 spec files. `app/domains/` = 72% of code, 83 domains
- Domain `restaurant` = 1,156 files (quarter of all code) — too broad to be a scope boundary
- Spec:code ratio — entire app 37%, accounting 30%, restaurant 26%, **report 3%**, **jurnal 3%**
- 25 files over 800 lines; largest is `app/models/concerns/product_logic.rb` (2,648 lines)
- CI exists and is complete: `bitbucket-pipelines.yml` runs rspec, rubocop, brakeman

## Corrections and Traps Already Found

Things that went wrong and were fixed. Written here to avoid repeating.

1. **"report 3% tests" number is misleading if used raw.** Report jobs have tests, but they sit in `spec/domains/restaurant/jobs/report/`, not in the `report` folder. Report functions are better tested than the folder ratio suggests.
2. **Don't judge ticket quality from To Do backlog alone.** That's a pile nobody has picked up — the sample is biased toward failure. Initial analysis was too harsh because of this error.
3. **Blocklist contains 41 paths**, not 44. Was miscounted once.
4. **Tickets can contain plaintext credentials.** RR-6966 contained staging username and password. If such a ticket enters agent transcript, credentials are permanently stored in `runs/`. Redact when entering into `queue.json`, and escalate to Runchise.
5. **Ticket title can mismatch its content.** RR-7035 title is about "scheduled menu", reproduction steps are about Bulk Action → Change Sell Price. Plan stage should return `NEEDS_SPEC`, not guess. This ticket is intentionally left in `queue.json` as a test case.
6. **Relative paths in config are resolved from project root** (directory containing `package.json`), not from `config/` folder. Once wrong, made `../runchise` go astray.
7. **Unrecognized `/api/` endpoints must return JSON**, not fall through to HTML fallback — otherwise a typo looks like success.

## What's Easiest to Get Wrong

- **Expanding scope.** Pilot area was intentionally chosen as easiest: export layer and output formats (pure functions, no money calculation, fast tests). Results there **cannot** be extrapolated to `accounting` or `restaurant` domains. Tell this to the client before they conclude it themselves.
- **Filling three review fields.** `humanEditedLines`, `reviewRounds`, `merged` can only be filled by humans. Without them, autonomy rate — the pilot's main metric — is forever empty. That's the main justification for the UI existing.
- **Writing many slow or flaky tests.** That narrows the gate, doesn't widen it. Success metric isn't test count, but tests that pass consistently and quickly.
- **Locking odd behavior into tests.** If the agent discovers strange behavior not part of the ticket, escalate to human — don't codify it as official rules.
