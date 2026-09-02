# Spectr — Product & Business Source of Truth

> This document is the canonical source of truth for **what Spectr is, what it
> does, and every business decision**. When in doubt about product behavior,
> pricing, quotas, payment, or AI behavior, this document wins. Technical setup
> lives in `README.md`; this document owns product intent and business rules.

---

## 1. What Spectr is

Spectr turns a messy client brief into an execution-ready spec — **one AI
pipeline, not five tools**. Built by **Etalas Studio** for teams and agencies
that work with AI agents (Pi, Claude Code, Codex).

Spectr is the **end-user (web) evolution** of
[Spectr v1 (formerly Sandwich)](https://github.com/etalasaccounts/sandwich) — a Claude Code
plugin/skill stack (terminal-based). v1's pipeline (`/order` → `/craft` →
`/prep`) is the conceptual ancestor of v2's chat-based document generation.

Core promise: *"From a messy brief to an execution-ready spec."*

## 2. What it does

- **Guided, chat-based document generation.** A user drops a brief, the AI asks
  what to generate, asks clarifying questions, then produces a **persistent,
  versioned document** — not just an inline chat reply.
- **Deliverables:** PRD, Quotation, Prototype, Specs.
- **Prototype is chat-generated** with a **live-preview sidebar** (no separate
  form).
- **Every document is a file in the project's git repository**; Postgres keeps
  only an index row (path + latest commit). The user can ask about it later in
  the same or a new session.
- **Attachments:** image / audio / PDF / docx → extracted to text (Cloudflare R2).
- **Share links:** read-only public view of a conversation.
- **Subscriptions:** Starter and Pro plans, paid via Midtrans Snap.

## 3. Document types (deliverables)

| Type | What Spectr produces |
|------|------------------------|
| `prd` | Canonical requirements: modules, features, constraints, confidence markers. Includes **user flows** and **technical notes** as sections. |
| `quotation` | Client cost estimate: scope, timeline, pricing, assumptions, terms. |
| `prototype` | **Single self-contained `prototype/index.html`** (inline CSS/JS, Chart.js + Lucide from CDN), rendered in the live-preview sidebar. Multi-view UIs use in-page sections, not separate files. |
| `specs` | Feature queue + one spec per feature (scope + acceptance criteria), like v1. |

**`mom`** started as an *input* (meeting notes a user pastes). It now also has a
fixed on-disk slot (`mom.md`) alongside the other deliverables so a run can read
or write it. `workflow` and `general` are not standalone document types.

## 4. Generation flow (model-driven)

The flow is a **deterministic state machine owned by the backend** — the AI only
generates content for each step (non-deterministic output inside a deterministic
wrapper).

```
intake → choosing_deliverable → clarifying → generating → awaiting_next
```

- `intake` — user drops a brief.
- `choosing_deliverable` — AI asks "what do you want to generate?" (PRD / quotation / prototype / specs).
- `clarifying` — AI asks deliverable-specific questions.
- `generating` — the relevant engine produces the document (one version).
- `awaiting_next` — AI asks what the next deliverable should be.

Documents are generated **one at a time**, never dumped as a batch.

## 5. Data model

```
projects       id, user_id, title            — owns one on-disk git repo
conversations  thread; project_id             — many per project
documents      id, project_id, conversation_id (generated-in, nullable),
               type, title, relative_path, last_commit_sha
chat_messages  the conversation history
```

Postgres stores **no document content**. Each `documents` row points at a file
in the project's git working tree.

**On-disk layout** — `${PROJECTS_ROOT}/<userId>/<projectId>/`:

```
.git/                  version history (one commit per generation run)
BRIEF.md               consolidated brief + Q&A + attachment summaries (M2-02)
prd.md  quotation.md  spec.md  mom.md
prototype/index.html
.gitignore             engine scratch (.getokui/ .reference/ .pi/) — never committed
```

- Documents are **project-scoped: one per type per project.** Generating a
  second PRD in a project overwrites the first (as a new commit). Two PRDs → two
  projects.
- **Title-scoped retrieval** stays as a convenience lookup (`user + title`), no
  longer the identity.
- Retrieval is **explicit** ("buka PRD X" / click in the sidebar), not semantic.
- Pi agent sessions are **disk-backed, one per conversation**, under
  `PI_SESSIONS_ROOT` — outside the project dir so no session file is committed.
  Several conversations in one project each keep their own session while sharing
  the same `cwd` (the project files). Resuming a conversation resumes its
  session; on a resumed turn only the new message is sent (the session carries
  the transcript). Deleting a conversation removes its session store. Compaction
  is on for the text engine's session (it persists and would otherwise grow
  unbounded); off for the single-shot prototype pass.

## 6. Engine strategy

One **orchestrator**, two engines. Both run **like a local coding agent**: `cwd`
is the project directory, context comes from the files there (`BRIEF.md`, sibling
deliverables), and output is written back as files.

| Engine | For | Tools |
|--------|-----|-------|
| Text engine | `prd`, `quotation`, `specs`, `mom` | read-only (`read`/`ls`/`grep`/`find`) while chatting; `write`/`edit` added only while generating. **No `bash`.** |
| Prototype engine | `prototype` | `read`/`write`/`edit`/`ls`/`grep`/`find` + `bash` (env-scrubbed) |

**On the text engine's tools:** it used to be tool-free — tools once caused
hangs. They are back because (a) an **inactivity watchdog** (`engine/tool-budget.ts`)
aborts a run that stops emitting events, catching the actual historical failure
mode, which was a stall; (b) a **tool-call ceiling** caps runaway loops; (c) chat
stages get read-only tools so a stall can't corrupt the tree; (d) `TEXT_ENGINE_TOOLS=off`
forces tool-free operation without a redeploy.

**Isolation caveat:** Pi's tools resolve *relative* paths to `cwd` but pass
absolute paths through — there is no sandbox. `bash` is dropped from the text
engine and env-scrubbed for the prototype engine (`engine/bash-tool.ts`); real
per-tenant isolation is **M5-05**, required before multi-tenant launch.

**Glowup** (the prototype polish pass) is retained in the codebase but **not
wired into the pipeline** (`GLOWUP_ENABLED` defaults off) — its prompt targets
the retired multi-file model.

## 7. Versioning

- Every successful generation / revision = **one git commit** in the project repo
  (structured message with `Sandwich-Deliverable` / `Sandwich-Conversation`
  trailers). `documents.last_commit_sha` points at the latest.
- An **empty diff produces no commit** and a "nothing changed" reply.
- Rollback ("rollback ke versi sebelumnya") is a `git checkout` of the file + a
  new commit — no history rewrite. Ordinal rollback, history and diff APIs, and
  the sidebar version picker arrive with **M3**; until then the UI shows the
  short commit sha, not a version number.

## 8. UI

- **Sidebar = Document panel:** lists documents; shows the **live preview** for a
  `prototype`, latest content + version history for others.
- Landing prompt box (logged-in) starts an `intake` conversation (does **not**
  auto-generate a PRD).
- "Get Started" for logged-in users goes to `/dashboard`.

## 9. Plans, pricing & quotas

### Plans

- **Starter is free.** Only Starter (free) and Pro (paid).

| Plan | Price | Documents | AI chat |
|------|-------|-----------|---------|
| **Starter** | Free (was Rp 50.000 / 30 days) | 5 PRDs / month | 100 messages / month |
| **Pro** | Rp 100.000 / 30 days (shown as discounted from Rp 250.000) | Unlimited | Unlimited |

### Quota rules

- The **document quota counts only generated PRD documents** (not conversations).
- The **chat quota counts every user follow-up message**
  (`POST /api/conversations/:id/messages`).
- Quotas reset **monthly** (`year_month` key) and are **enforced server-side**.

## 10. Subscription & payment

### Model

- **One-time Midtrans Snap payment + app-managed subscription expiry.** We do
  **not** use Midtrans Subscription API / recurring (card + GoPay only).
- Period is a **flat 30 days**; **no grace period**.
- **Manual renewal** (no auto-renew cron yet).

### Rules

- Renewal extends from `max(now, current expires_at) + 30 days`.
- **Full refund** revokes the subscription; partial refund only records state.
- Subscription activation happens **only** in the verified Midtrans webhook.
- Payment state machine (monotonic):
  `creating_payment → awaiting_payment → paid | failed | cancelled | expired | partially_refunded → refunded`.

### Payment UX

- **Snap popup** (`snap.js` + `snap.pay`). Redirect mode exists in the backend
  but was reverted to popup (ad-blockers break the Midtrans redirect page).

## 11. AI engine configuration

- **Primary:** OpenCode (Pi SDK), provider `opencode-go`.
- **Fallback:** Groq — text only, chat flow only.
- **Default model:** `deepseek-v4-pro` (reasoning, slow). Recommended for speed:
  `deepseek-v4-flash`.
- **Timeouts:** 5 minutes (text, outer backstop), 10 minutes (prototype). Plus a
  per-run tool-call ceiling and an inactivity watchdog (see §6).

## 12. Architecture (summary)

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, `node:http`, custom router |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 19, Vite, Tailwind CSS 4, React Query |
| AI | Pi SDK (OpenCode) primary, Groq fallback |
| Payment | Midtrans Snap |
| Storage | Cloudflare R2 (attachments) · per-project git repo on a persistent volume (deliverables) |
| Deploy | Railway (API, **single instance** — the volume is single-attach) + separate frontend host |

Key backend areas:

- `apps/server/routes/` — HTTP handlers.
- `apps/server/pipeline/` — Midtrans client, payment status, plan catalog.
- `apps/server/prototype/` — prototype engine (to be unified under the orchestrator).
- `apps/server/db/` — Drizzle schema + repos.

## 13. Deployment & domains

| Domain | Purpose |
|--------|---------|
| `spectr.id` | Frontend (static) |
| `api.spectr.id` | Backend API + webhook |
| `preview.spectr.id` | Prototype previews (`/p/{shareId}/`) |

Midtrans webhook: `https://api.spectr.id/api/midtrans/notification`.

## 14. Removed / deferred (explicit decisions)

- ❌ **"Premium AI model"** — removed (same model for all plans).
- ❌ **"Direct chat with Raf Dev"** — removed.
- ❌ **"Priority processing"** — removed for now (next phase).
- ❌ **Free tier / "free forever"** — removed.
- ❌ **Landing attachment upload** — removed.
- ❌ **`mom` / `workflow` / `general` as outputs** — removed.

## 15. Known caveats (non-blocking)

- `apps/server/routes/integrations.test.ts` fails when `GROQ_API_KEY` is set
  locally (env-dependent, unrelated to payment).
- GitHub flags 1 high-severity Dependabot alert on the default branch.
- **No version history in the UI** between this milestone and M3-03 — the sidebar
  shows a short commit sha instead of a version dropdown, and the old
  `POST /api/documents/:id/rollback` endpoint is gone (chat "rollback" still works).
- **`PROJECTS_ROOT` must be a mounted volume in production.** The server refuses
  to boot if it is unset with `NODE_ENV=production`, or if the path is not
  writable — an ephemeral-disk fallback would lose every artifact on redeploy.
- Engine tool execution is **not yet tenant-isolated** (M5-05).
