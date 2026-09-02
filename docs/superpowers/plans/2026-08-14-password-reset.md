# Password Reset (Email-based) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "forgot password" flow — submit email, receive a one-time reset link (Resend), set a new password.

**Architecture:** New `password_reset_tokens` table + token repo; a Resend REST email module; two public routes (`forgot-password`, `reset-password`); two new frontend pages wired into AuthGate.

**Tech Stack:** TypeScript (Node 22 ESM), Drizzle ORM (PostgreSQL), Resend REST API via `fetch`, React 19.

## Global Constraints

- Server ESM (`"type":"module"`), `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `rootDir: apps/server`, `outDir: dist`.
- Tests use `node:test` + `node:assert/strict`, files `*.test.ts`.
- Timestamps use the `ts()` helper (`timestamp(..., { withTimezone: true, mode: "date" })`) — values are `Date`.
- Session auth via `authenticateRequest(db, req)`.
- Public paths are exempted via `PUBLIC_API_PATHS` in `web-server.ts`.
- `RESEND_API_KEY` and `EMAIL_FROM` already exist in `.env`; `APP_URL` is new (default `http://localhost:3000`).
- Password hashing via `hashPassword` from `apps/server/auth/password.js`.

---

### Task 1: DB — table + getUserByEmail + deleteSessionsForUser

**Files:**
- Modify: `apps/server/db/schema.ts`
- Modify: `apps/server/db/users.ts`
- Modify: `apps/server/db/sessions.ts`

**Interfaces:**
- Produces: `passwordResetTokens` table; `getUserByEmail(db, email)`; `deleteSessionsForUser(db, userId)`.

- [ ] **Step 1: Add the table to schema.ts**

Append to `apps/server/db/schema.ts`:

```typescript
export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull(),
});
```

- [ ] **Step 2: Add `getUserByEmail` to users.ts**

In `apps/server/db/users.ts`, after `getUserByUsername`:

```typescript
export async function getUserByEmail(db: Database, email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) return null;
  return mapUser(rows[0]!);
}
```

- [ ] **Step 3: Add `deleteSessionsForUser` to sessions.ts**

In `apps/server/db/sessions.ts`, after `deleteSession`:

```typescript
export async function deleteSessionsForUser(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
```

- [ ] **Step 4: Generate + apply migration**

```bash
npx drizzle-kit generate --config apps/server/drizzle.config.ts
npx drizzle-kit migrate --config apps/server/drizzle.config.ts
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/db/schema.ts apps/server/db/users.ts apps/server/db/sessions.ts apps/server/db/drizzle/
git commit -m "feat: password_reset_tokens table + user lookup helpers"
```

---

### Task 2: Email module (Resend)

**Files:**
- Create: `apps/server/pipeline/email.ts`
- Test: `apps/server/pipeline/email.test.ts`

**Interfaces:**
- Produces: `sendEmail(input: { to: string; subject: string; text: string; html?: string }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `apps/server/pipeline/email.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { describe, it, afterEach } from "node:test";
import { sendEmail } from "./email.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("sendEmail", () => {
  it("throws when config is missing", async () => {
    delete process.env.RESEND_API_KEY;
    await assert.rejects(
      () => sendEmail({ to: "a@b.com", subject: "s", text: "t" }),
      /RESEND_API_KEY/,
    );
  });

  it("POSTs to Resend with bearer auth and correct body", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: any, init: any) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }) as any;
    await sendEmail({ to: "user@example.com", subject: "Hi", text: "Body" });
    assert.equal(captured!.url, "https://api.resend.com/emails");
    const headers = captured!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer re_test");
    const body = JSON.parse(captured!.init.body as string);
    assert.equal(body.from, "no-reply@example.com");
    assert.equal(body.to, "user@example.com");
    assert.equal(body.subject, "Hi");
  });

  it("throws on non-2xx", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    globalThis.fetch = (async () => new Response("boom", { status: 422 })) as any;
    await assert.rejects(
      () => sendEmail({ to: "u@b.com", subject: "s", text: "t" }),
      /Resend 422/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/email.test.js
```

Expected: FAIL — `Cannot find module './email.js'`.

- [ ] **Step 3: Implement the module**

Create `apps/server/pipeline/email.ts`:

```typescript
export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/email.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/pipeline/email.ts apps/server/pipeline/email.test.ts
git commit -m "feat: Resend email module"
```

---

### Task 3: Reset token repo

**Files:**
- Create: `apps/server/db/repo/password-resets.ts`

**Interfaces:**
- Produces: `createResetToken(db, userId): Promise<string>`, `getValidResetToken(db, token): Promise<PasswordResetToken | null>`, `markResetTokenUsed(db, token): Promise<void>`.

- [ ] **Step 1: Write the module**

Create `apps/server/db/repo/password-resets.ts`:

```typescript
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { passwordResetTokens } from "../schema.js";
import type { Database } from "../connection.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export async function createResetToken(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(passwordResetTokens).values({
    token,
    userId,
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    createdAt: now,
  });
  return token;
}

export async function getValidResetToken(
  db: Database,
  token: string,
): Promise<PasswordResetToken | null> {
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0]!;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return {
    token: row.token,
    userId: row.userId,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  };
}

export async function markResetTokenUsed(db: Database, token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/db/repo/password-resets.ts
git commit -m "feat: password reset token repo"
```

---

### Task 4: Routes + wiring

**Files:**
- Create: `apps/server/routes/password-reset.ts`
- Modify: `apps/server/web-server.ts`

**Interfaces:**
- Produces: `registerPasswordResetRoutes(router, db)`.

- [ ] **Step 1: Write the routes module**

Create `apps/server/routes/password-reset.ts`:

```typescript
import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { getUserByEmail, updatePassword } from "../db/users.js";
import { deleteSessionsForUser } from "../db/sessions.js";
import {
  createResetToken,
  getValidResetToken,
  markResetTokenUsed,
} from "../db/repo/password-resets.js";
import { hashPassword } from "../auth/password.js";
import { sendEmail } from "../pipeline/email.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";

function resetLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

export function registerPasswordResetRoutes(router: Router, db: Database): void {
  router.post("/api/auth/forgot-password", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as { email?: string } | null;
    if (!body?.email) {
      sendJson(res, 400, { error: "email is required" });
      return;
    }

    const user = await getUserByEmail(db, body.email.trim());
    if (user) {
      try {
        const token = await createResetToken(db, user.id);
        const link = resetLink(token);
        await sendEmail({
          to: user.email,
          subject: "Reset password Spectr",
          text: `Reset password kamu: ${link}`,
          html: `<p>Klik link ini untuk reset password:</p><p><a href="${link}">${link}</a></p>`,
        });
      } catch (err) {
        sendCaughtError(res, err, "forgot password");
        return;
      }
    }

    // Always respond ok — do not reveal whether the email exists.
    sendJson(res, 200, { ok: true });
  });

  router.post("/api/auth/reset-password", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as {
      token?: string;
      newPassword?: string;
    } | null;
    if (!body?.token || !body?.newPassword) {
      sendJson(res, 400, { error: "token and newPassword are required" });
      return;
    }

    const tokenRow = await getValidResetToken(db, body.token);
    if (!tokenRow) {
      sendJson(res, 400, { error: "invalid or expired token" });
      return;
    }

    const newHash = await hashPassword(body.newPassword);
    await updatePassword(db, tokenRow.userId, newHash);
    await markResetTokenUsed(db, body.token);
    await deleteSessionsForUser(db, tokenRow.userId);

    sendJson(res, 200, { ok: true });
  });
}
```

- [ ] **Step 2: Wire into web-server.ts**

Add the import (next to the other route imports):

```typescript
import { registerPasswordResetRoutes } from "./routes/password-reset.js";
```

Add the two paths to `PUBLIC_API_PATHS`:

```typescript
const PUBLIC_API_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/midtrans/notification",
]);
```

Register the routes (after `registerAuthRoutes`):

```typescript
  registerAuthRoutes(router, db, PUBLIC_API_PATHS);
  registerPasswordResetRoutes(router, db);
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/routes/password-reset.ts apps/server/web-server.ts
git commit -m "feat: password reset routes + wiring"
```

---

### Task 5: Frontend — forgot/reset pages + login button

**Files:**
- Modify: `apps/web/src/api/auth.ts`
- Create: `apps/web/src/components/ForgotPasswordPage.tsx`
- Create: `apps/web/src/components/ResetPasswordPage.tsx`
- Modify: `apps/web/src/components/LoginForm.tsx`
- Modify: `apps/web/src/components/AuthGate.tsx`
- Modify: `apps/web/src/lib/i18n.tsx`

**Interfaces:**
- Consumes: `apiUrl`, `useLanguage`, `useNavigate`, `useSearchParams`.
- Produces: `postForgotPassword`, `postResetPassword`; `ForgotPasswordPage`, `ResetPasswordPage`; `LoginForm.onForgotPassword`.

- [ ] **Step 1: Add API client functions**

In `apps/web/src/api/auth.ts`, append:

```typescript
export async function postForgotPassword(email: string): Promise<void> {
  await postJson(apiUrl('/api/auth/forgot-password'), { email })
}

export async function postResetPassword(token: string, newPassword: string): Promise<void> {
  await postJson(apiUrl('/api/auth/reset-password'), { token, newPassword })
}
```

- [ ] **Step 2: Add i18n keys**

In `apps/web/src/lib/i18n.tsx`, inside the `STRINGS` object (near the auth keys around `login_title`), add:

```typescript
  login_forgot_password: { en: 'Forgot password?', id: 'Lupa password?' },
  forgot_title: { en: 'Reset password', id: 'Reset password' },
  forgot_subtitle: { en: "Enter your email and we'll send a reset link.", id: 'Masukkan email kamu dan kami kirim link reset.' },
  forgot_email_placeholder: { en: 'Email', id: 'Email' },
  forgot_submit: { en: 'Send reset link', id: 'Kirim link reset' },
  forgot_success: { en: 'If that email is registered, a reset link has been sent.', id: 'Kalau email itu terdaftar, link reset sudah dikirim.' },
  reset_title: { en: 'Set new password', id: 'Atur password baru' },
  reset_subtitle: { en: 'Choose a new password for your account.', id: 'Pilih password baru untuk akun kamu.' },
  reset_new_password: { en: 'New password', id: 'Password baru' },
  reset_confirm_password: { en: 'Confirm password', id: 'Konfirmasi password' },
  reset_submit: { en: 'Update password', id: 'Perbarui password' },
  reset_success: { en: 'Password updated. You can now log in.', id: 'Password diperbarui. Kamu bisa login sekarang.' },
  reset_mismatch: { en: 'Passwords do not match', id: 'Password tidak cocok' },
```

- [ ] **Step 3: Add "Lupa password?" to LoginForm**

In `apps/web/src/components/LoginForm.tsx`, add an optional `onForgotPassword` prop and render a button below the password field.

Add to the props interface:

```typescript
  onForgotPassword?: () => void
```

Update the function signature:

```typescript
export default function LoginForm({ onSubmit, error, isPending, onBack, onSwitchToRegister, onForgotPassword }: LoginFormProps) {
```

Add the button right after the password field `</div>` and before the `{error && (` block:

```tsx
          {onForgotPassword && (
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={onForgotPassword} className="text-xs font-semibold underline" style={{ color: '#f91814' }}>
                {tr('login_forgot_password')}
              </button>
            </div>
          )}
```

- [ ] **Step 4: Create ForgotPasswordPage**

Create `apps/web/src/components/ForgotPasswordPage.tsx`:

```tsx
import { useState } from 'react'
import { useLanguage } from '../lib/i18n'
import { postForgotPassword } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { t: tr } = useLanguage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (!email.trim()) return
    setPending(true)
    setError(null)
    try {
      await postForgotPassword(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('forgot_title')}</h1>
        <p className="text-sm text-zinc-500 text-center mb-7">{tr('forgot_subtitle')}</p>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('forgot_success')}</p>
            <button onClick={onBack} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
              <iconify-icon icon="solar:letter-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus aria-label="Email" placeholder={tr('forgot_email_placeholder')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
            </div>
            {error && <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{error}</p>}
            <button type="submit" disabled={pending} className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2" style={{ backgroundColor: '#0a0a0a' }}>{tr('forgot_submit')}</button>
            <button type="button" onClick={onBack} className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80" style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}>{tr('auth_back')}</button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create ResetPasswordPage**

Create `apps/web/src/components/ResetPasswordPage.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'
import { postResetPassword } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function ResetPasswordPage({ onBack }: { onBack: () => void }) {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!token) { setError(tr('reset_mismatch')); return }
    if (!password || password !== confirm) { setError(tr('reset_mismatch')); return }
    setPending(true)
    setError(null)
    try {
      await postResetPassword(token, password)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
          <p className="text-sm text-center rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('reset_success')}</p>
          <button onClick={() => navigate('/')} className="w-full mt-4 py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('reset_title')}</h1>
        <p className="text-sm text-zinc-500 text-center mb-7">{tr('reset_subtitle')}</p>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="New password" placeholder={tr('reset_new_password')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F4EBE1' }}>
            <iconify-icon icon="solar:lock-password-linear" width="18" style={{ color: 'rgba(0,0,0,0.35)', display: 'block' }} />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-label="Confirm password" placeholder={tr('reset_confirm_password')} className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none" />
          </div>
          {error && <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{error}</p>}
          <button type="submit" disabled={pending} className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2" style={{ backgroundColor: '#0a0a0a' }}>{tr('reset_submit')}</button>
          <button type="button" onClick={onBack} className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80" style={{ border: '1.5px solid #0a0a0a', color: '#0a0a0a', backgroundColor: 'transparent' }}>{tr('auth_back')}</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire pages into AuthGate**

In `apps/web/src/components/AuthGate.tsx`, add imports:

```typescript
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
```

Add the two routes after the landing-page block (`if (location.pathname === '/') { ... }`) and before `if (isLoading)`:

```typescript
  if (location.pathname.startsWith('/forgot-password')) {
    return <ForgotPasswordPage onBack={() => navigate('/')} />
  }

  if (location.pathname.startsWith('/reset-password')) {
    return <ResetPasswordPage onBack={() => navigate('/')} />
  }
```

Pass `onForgotPassword` to both `LoginForm` renders (the `/dashboard` unauth branch and the `/checkout` unauth branch). Change:

```tsx
      return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView(null)} />
```

to:

```tsx
      return <LoginForm onSubmit={login} error={loginError} isPending={loginPending} onBack={() => navigate('/')} onSwitchToRegister={() => setForceView(null)} onForgotPassword={() => navigate('/forgot-password')} />
```

(Do this for BOTH occurrences — the `/dashboard` branch and the `/checkout` branch, plus the fallback `LoginForm` at the bottom of the file.)

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
npm --prefix apps/web run typecheck
git add apps/web/src/api/auth.ts apps/web/src/components/ForgotPasswordPage.tsx apps/web/src/components/ResetPasswordPage.tsx apps/web/src/components/LoginForm.tsx apps/web/src/components/AuthGate.tsx apps/web/src/lib/i18n.tsx
git commit -m "feat: forgot/reset password UI + login button"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full test suite + typecheck**

```bash
npm test
npm --prefix apps/web run typecheck
```

Expected: all pass (40 + new email tests).

- [ ] **Step 2: Restart the server (to load new code + migration)**

Kill the running `tsx` server and start it fresh:

```bash
# Find and stop the existing server, then:
npx tsx apps/server/web-server.ts
```

- [ ] **Step 3: Verify the flow live**

```bash
# 1. Forgot password (should always return ok)
curl -s -X POST http://localhost:4319/api/auth/forgot-password -H "content-type: application/json" -d '{"email":"c@etalas.com"}'

# 2. Read the reset token from the DB
psql -d sandwich -t -A -c "SELECT token FROM password_reset_tokens ORDER BY created_at DESC LIMIT 1;"

# 3. Reset password with the token
curl -s -X POST http://localhost:4319/api/auth/reset-password -H "content-type: application/json" -d '{"token":"<TOKEN>","newPassword":"newpass123"}'

# 4. Login with the new password (should succeed)
curl -s -X POST http://localhost:4319/api/auth/login -H "content-type: application/json" -d '{"username":"aziz","password":"newpass123"}'
```

Expected: step 1 `{"ok":true}`, step 3 `{"ok":true}`, step 4 returns a user + session cookie.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: e2e verification fixes"
```
