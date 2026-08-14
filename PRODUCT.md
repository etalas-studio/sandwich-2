# SANDWICH v2 — Product & Business Source of Truth

> This document is the canonical source of truth for **what SANDWICH v2 is, what it
> does, and every business decision**. When in doubt about product behavior,
> pricing, quotas, payment, or AI behavior, this document wins. Technical setup
> lives in `README.md`; this document owns product intent and business rules.

---

## 1. What SANDWICH v2 is

SANDWICH turns a messy client brief into an execution-ready spec — **one AI
pipeline, not five tools**. Built by **Etalas Studio** for teams and agencies
that work with AI agents (Pi, Claude Code, Codex).

SANDWICH v2 is the **end-user (web) evolution** of
[SANDWICH v1](https://github.com/etalasaccounts/sandwich) — a Claude Code
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
- **Every document is a versioned file** stored in the database; the user can ask
  about it later in the same or a new session.
- **Attachments:** image / audio / PDF / docx → extracted to text (Cloudflare R2).
- **Share links:** read-only public view of a conversation.
- **Subscriptions:** Starter and Pro plans, paid via Midtrans Snap.

## 3. Document types (deliverables)

| Type | What SANDWICH produces |
|------|------------------------|
| `prd` | Canonical requirements: modules, features, constraints, confidence markers. Includes **user flows** and **technical notes** as sections. |
| `quotation` | Client cost estimate: scope, timeline, pricing, assumptions, terms. |
| `prototype` | Multi-file static prototype (`index.html`, `dashboard.html`, `styles.css`, `script.js`, + one page per module), rendered in the live-preview sidebar. |
| `specs` | Feature queue + one spec per feature (scope + acceptance criteria), like v1. |

**Not deliverables (explicit):** `mom` is an *input* (meeting notes a user pastes),
not an output. `workflow` and `general` are not standalone document types.

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

## 5. Data model (title-scoped)

```
conversations            thread (no single type/output)
documents                id, user_id, type, title, current_version_id
document_versions        id, document_id, version_no, content, prompt_used, created_at
conversation_documents   conversation_id, document_id   (generated-in / opened-in)
document_files           prototype multi-file (path + content)
chat_messages            the conversation history
```

- Documents are **user-scoped**, not conversation-scoped.
- **Title-scoped retrieval:** the AI proposes a title on generation (user can
  rename); a later session finds the document by `user_id + title/type`.
- Retrieval is **explicit** ("buka PRD X" / click in the sidebar), not semantic.

## 6. Engine strategy

One **orchestrator**, two engines:

| Engine | For | Mode |
|--------|-----|------|
| Text engine | `prd`, `quotation`, `specs` | tool-free, Groq fallback |
| Prototype engine | `prototype` | OpenCode + tools (write files) |

The orchestrator picks the engine from the requested deliverable. The text agent
stays **tool-free** (tools caused hangs/misbehavior); the prototype engine uses
tools to emit files into a workspace.

## 7. Versioning

- Every generation / revision = a **new `document_versions` row** (immutable).
- Revising a document creates a new version of the *same* document.
- The sidebar shows the version history (and, later, per-prompt diffs).

## 8. UI

- **Sidebar = Document panel:** lists documents; shows the **live preview** for a
  `prototype`, latest content + version history for others.
- Landing prompt box (logged-in) starts an `intake` conversation (does **not**
  auto-generate a PRD).
- "Get Started" for logged-in users goes to `/dashboard`.

## 9. Plans, pricing & quotas

### Plans

- **No free tier.** Only Starter and Pro.

| Plan | Price | Documents | AI chat |
|------|-------|-----------|---------|
| **Starter** | Rp 50.000 / 30 days | 5 PRDs / month | 100 messages / month |
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
- **Timeouts:** 3 minutes (text), 10 minutes (prototype).

## 12. Architecture (summary)

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, `node:http`, custom router |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 19, Vite, Tailwind CSS 4, React Query |
| AI | Pi SDK (OpenCode) primary, Groq fallback |
| Payment | Midtrans Snap |
| Storage | Cloudflare R2 (attachments) |
| Deploy | Railway (API) + separate frontend host |

Key backend areas:

- `apps/server/routes/` — HTTP handlers.
- `apps/server/pipeline/` — Midtrans client, payment status, plan catalog.
- `apps/server/prototype/` — prototype engine (to be unified under the orchestrator).
- `apps/server/db/` — Drizzle schema + repos.

## 13. Deployment & domains

| Domain | Purpose |
|--------|---------|
| `sandwich.etalas.com` | Frontend (static) |
| `api.sandwich.etalas.com` | Backend API + webhook |
| `preview.sandwich.etalas.com` | Prototype previews (`/p/{shareId}/`) |

Midtrans webhook: `https://api.sandwich.etalas.com/api/midtrans/notification`.

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
