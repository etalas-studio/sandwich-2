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

The core promise: *"From a messy brief to an execution-ready spec — PRD,
prototype, MOM, quotation."*

## 2. What it does

- **Chat-based brief → generated documents.** A user writes a brief, the AI asks
  clarifying questions, then produces a document.
- **Document types:** PRD, MOM, quotation, specs & task, workflow, and chat
  prototype (inline HTML).
- **Prototype builder** (separate from chat): multi-file, live-preview static
  prototype with an "iterate" panel (Lovable-style).
- **Attachments:** image / audio / PDF / docx → extracted to text and fed into
  the prompt (Cloudflare R2 storage).
- **Share links:** read-only public view of a conversation.
- **Subscriptions:** Starter and Pro plans, paid via Midtrans Snap.

## 3. Document types & AI behavior

| Type | What the AI produces |
|------|----------------------|
| `prd` | Full PRD document (markdown) |
| `mom` | Minutes of meeting |
| `quotation` | Project quotation / cost estimate |
| `specs` / `workflow` | Technical specs & task breakdown |
| `general` | Keyword-based fallback (auto-detects PRD / flow / tech / quotation / prototype) |
| `prototype` (chat) | Single self-contained HTML (inline in chat) |
| Prototype builder | Multi-file: `index.html`, `dashboard.html`, `styles.css`, `script.js`, + one page per module |

The **conversation `type`** (chosen via chip) is the **primary** signal for what
to generate. Keyword matching on the text is only a fallback for type `general`.
This was changed because naive substring matching (`includes("ui")` etc.) was
silently forcing everything into HTML.

## 4. Plans, pricing & quotas

### Plans

- **No free tier.** Only Starter and Pro.

| Plan | Price | Documents | AI chat |
|------|-------|-----------|---------|
| **Starter** | Rp 50.000 / 30 days | 5 PRDs / month | 100 messages / month |
| **Pro** | Rp 100.000 / 30 days (shown as discounted from Rp 250.000) | Unlimited | Unlimited |

### Quota rules (business decisions)

- The **document quota counts only `type=prd`**. MOM, quotation, specs, workflow,
  general, and chat-prototype do **not** consume the document quota.
- The **chat quota counts every user follow-up message**
  (`POST /api/conversations/:id/messages`), including the first message of a new
  conversation.
- Quotas reset **monthly** (`year_month` key) and are **enforced server-side**
  (403 when exceeded). Frontend gating is UX only.

## 5. Subscription & payment

### Model

- **One-time Midtrans Snap payment + app-managed subscription expiry.** We do
  **not** use Midtrans Subscription API / recurring (that only covers card +
  GoPay, and we want QRIS/VA/e-wallet coverage).
- Period is a **flat 30 days** from activation/renewal.
- **No grace period.** Access ends the moment `expires_at` passes.
- **Manual renewal** (no auto-renew cron yet): an expired/expiring user pays
  again via checkout to extend.

### Rules

- Renewal extends from `max(now, current expires_at) + 30 days`.
- **Full refund** (`transaction_status=refund`) **revokes** the subscription.
  Partial refund only records state.
- Subscription activation happens **only** in the verified Midtrans webhook —
  never from the frontend (a client-triggered `POST /api/subscriptions` hole was
  removed).
- Payment state machine (monotonic — never regresses):
  `creating_payment → awaiting_payment → paid | failed | cancelled | expired | partially_refunded → refunded`.

### Payment UX

- **Snap popup** (`snap.js` + `snap.pay`). Redirect mode exists in the backend
  but was **reverted to popup** because ad-blockers break the Midtrans redirect
  page (CSP inline-script block). The `redirect_url` is still returned and saved.

## 6. Prototype

- **Two surfaces:**
  1. **Chat prototype** — a `type=prototype` conversation that returns a single
     self-contained HTML inline in chat.
  2. **Prototype builder** (`/prototype`) — the canonical "prototype" feature:
     form (name, brief, palette, logo) → OpenCode agent writes multiple files →
     live preview in an iframe + "iterate" panel.
- Sidebar **"Prototype"** opens the **list of built prototypes** (from
  `prototypes` table); **"New Prototype"** navigates to the builder form.
- Previews are served at `PREVIEW_DOMAIN/p/{shareId}/` (currently
  `https://preview.sandwich.etalas.com`).

## 7. AI engine

- **Primary:** OpenCode (Pi SDK), provider `opencode-go`.
- **Fallback:** Groq — text only, **only in the chat/conversation flow**. The
  prototype builder is OpenCode-only (needs tools).
- **Default model:** `deepseek-v4-pro` (a reasoning model — slow). Recommended
  for speed: `deepseek-v4-flash`.
- **Tools:** chat flow uses **no tools** (text only). Prototype builder uses
  `write`/`bash`/etc. to emit files.
- **Timeouts:** 3 minutes (chat), 10 minutes (prototype builder) — a hung engine
  call must fail instead of spinning forever.

## 8. Frontend UX decisions

- **Landing prompt box (logged-in):** submitting creates the conversation + first
  message, then redirects to `/dashboard` with the session **auto-running**. File/
  image attachment on the landing box was **removed**.
- **Landing "Get Started":** logged-in users go straight to `/dashboard`;
  unauthenticated users go to `/checkout` (register first). Pricing-card CTAs
  still go to `/checkout?plan=…`.
- **Gating is server-side source of truth** — no `localStorage` spoofable
  fallback (the old `sandwich_paid_plan` key was removed).

## 9. Architecture (summary)

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

- `apps/server/routes/` — HTTP handlers (auth, conversations, midtrans, usage, subscriptions, share, settings, purge).
- `apps/server/pipeline/` — Midtrans client, payment status model, plan catalog.
- `apps/server/prototype/` — prototype builder (engine, routes, storage, prompts).
- `apps/server/db/` — Drizzle schema + repos (migrations auto-run at startup).
- `apps/web/src/` — React app (AuthGate, Dashboard, CheckoutPage, PrototypeView/List, PaymentReturn, hooks, api client, i18n).

## 10. Deployment & domains

Split origin:

| Domain | Purpose |
|--------|---------|
| `sandwich.etalas.com` | Frontend (static) |
| `api.sandwich.etalas.com` | Backend API + webhook |
| `preview.sandwich.etalas.com` | Prototype previews (`/p/{shareId}/`) |

Critical env: `DATABASE_URL`, `TRUSTED_HOSTS` (all three domains), `CORS_ORIGIN`,
`COOKIE_SECURE`, `VITE_API_URL` (build-time), `OPENCODE_API_KEY` /
`OPENCODE_MODEL`, `GROQ_API_KEY` (fallback), `R2_*`, `MIDTRANS_*`,
`PREVIEW_DOMAIN`.

Midtrans webhook: `https://api.sandwich.etalas.com/api/midtrans/notification`.

## 11. Removed / deferred (explicit decisions)

- ❌ **"Premium AI model"** — removed (all plans use the same model).
- ❌ **"Direct chat with Raf Dev"** — removed (not implemented).
- ❌ **"Priority processing"** — removed for now (deferred to next phase; no
  queue/priority system exists).
- ❌ **Free tier / "free forever"** — removed (only Starter & Pro exist).
- ❌ **Landing attachment upload** — removed from landing prompt box.

## 12. Known caveats (non-blocking)

- `apps/server/routes/integrations.test.ts` fails when `GROQ_API_KEY` is set
  locally (env-dependent test, unrelated to payment).
- GitHub flags 1 high-severity Dependabot alert on the default branch
  (pre-existing, not introduced by recent work).
