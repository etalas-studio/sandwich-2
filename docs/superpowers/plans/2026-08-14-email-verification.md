# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require email verification before login. Register sends a one-time verification link; clicking it marks the email verified. Existing users are backfilled as verified.

**Architecture:** New `email_verified` column + `email_verification_tokens` table; verification token repo; register stops auto-login and sends email; login gates on `email_verified`; two public routes (verify-email, resend-verification); frontend "check email" screen + verify page.

**Tech Stack:** TypeScript (Node 22 ESM), Drizzle ORM, Resend REST API (existing `sendEmail`), React 19.

## Global Constraints

- Server ESM, `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`.
- Timestamps via `ts()` helper (`timestamp(..., { withTimezone: true, mode: "date" })`).
- `sendEmail` already exists in `apps/server/pipeline/email.ts`; `getUserByEmail`, `deleteSessionsForUser` already exist from the password-reset work.
- Public paths via `PUBLIC_API_PATHS` in `web-server.ts`.
- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` already in `.env`.

---

### Task 1: DB — email_verified column + tokens table + backfill

**Files:**
- Modify: `apps/server/db/schema.ts`
- Modify: `apps/server/db/users.ts`

- [ ] **Step 1: Add `emailVerified` to users + tokens table**

In `apps/server/db/schema.ts`, add to the `users` table (after `passwordHash`):

```typescript
  emailVerified: boolean("email_verified").notNull().default(false),
```

Append the tokens table (after `passwordResetTokens`):

```typescript
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull(),
});
```

- [ ] **Step 2: Update the User type + add `markEmailVerified`**

In `apps/server/db/users.ts`:

Add to the `User` interface:

```typescript
  emailVerified: boolean;
```

Add to `mapUser`:

```typescript
    emailVerified: row.emailVerified,
```

Add after `updatePassword`:

```typescript
export async function markEmailVerified(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
}
```

- [ ] **Step 3: Generate + apply migration + backfill**

```bash
npx drizzle-kit generate --config apps/server/drizzle.config.ts
npx drizzle-kit migrate --config apps/server/drizzle.config.ts
# Backfill existing users as verified (one-off for the dev DB):
psql -d sandwich -c "UPDATE users SET email_verified = true;"
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/db/schema.ts apps/server/db/users.ts apps/server/db/drizzle/
git commit -m "feat: email_verified column + email_verification_tokens table"
```

---

### Task 2: Verification token repo

**Files:**
- Create: `apps/server/db/repo/email-verifications.ts`

- [ ] **Step 1: Write the module**

```typescript
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { emailVerificationTokens } from "../schema.js";
import type { Database } from "../connection.js";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EmailVerificationToken {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export async function createVerificationToken(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(emailVerificationTokens).values({
    token,
    userId,
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
    createdAt: now,
  });
  return token;
}

export async function getValidVerificationToken(
  db: Database,
  token: string,
): Promise<EmailVerificationToken | null> {
  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
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

export async function markVerificationTokenUsed(db: Database, token: string): Promise<void> {
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.token, token));
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/db/repo/email-verifications.ts
git commit -m "feat: email verification token repo"
```

---

### Task 3: Auth service + routes

**Files:**
- Modify: `apps/server/auth/service.ts`
- Modify: `apps/server/routes/auth.ts`
- Create: `apps/server/routes/email-verification.ts`

- [ ] **Step 1: Change `register` to not create a session + gate login**

In `apps/server/auth/service.ts`:

Change the `register` return (no session):

```typescript
export async function register(db: Database, input: RegisterInput): Promise<{ user: User }> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await createUser(db, {
      username: input.username,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") {
      throw new AuthError(409, "username or email already taken");
    }
    throw err;
  }

  return { user };
}
```

Add the verification gate to `login` (after the password check, before creating a session):

```typescript
  if (!user.emailVerified) {
    throw new AuthError(403, "email not verified");
  }
```

- [ ] **Step 2: Update the register route to send the verification email**

In `apps/server/routes/auth.ts`, replace the register handler:

```typescript
  router.post("/api/auth/register", async (req, res) => {
    try {
      const body = (await readJsonBody(req)) as {
        username?: string;
        email?: string;
        password?: string;
      };
      if (!body.username || !body.email || !body.password) {
        throw new AuthError(400, "username, email, and password are required");
      }
      const { user } = await register(db, {
        username: body.username!,
        email: body.email!,
        password: body.password!,
      });

      const token = await createVerificationToken(db, user.id);
      const link = verificationLink(token);
      await sendEmail({
        to: user.email,
        subject: "Verify your email — SANDWICH",
        text: `Verifikasi email kamu: ${link}`,
        html: `<p>Klik link ini untuk verifikasi email:</p><p><a href="${link}">${link}</a></p>`,
      });

      sendJson(res, 201, {
        user: { username: user.username, email: user.email },
        verificationPending: true,
      });
    } catch (err) {
      sendCaughtError(res, err, "register");
    }
  });
```

Add imports to `routes/auth.ts`:

```typescript
import { createVerificationToken } from "../db/repo/email-verifications.js";
import { sendEmail } from "../pipeline/email.js";
```

Add a shared `verificationLink` helper (also used by the resend route). To avoid duplication, put `verificationLink` in `routes/email-verification.ts` and export it, then import it in `routes/auth.ts`. (See Step 3.)

- [ ] **Step 3: Write the verify/resend routes**

Create `apps/server/routes/email-verification.ts`:

```typescript
import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { getUserByEmail, markEmailVerified } from "../db/users.js";
import {
  createVerificationToken,
  getValidVerificationToken,
  markVerificationTokenUsed,
} from "../db/repo/email-verifications.js";
import { sendEmail } from "../pipeline/email.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";

export function verificationLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

export function registerEmailVerificationRoutes(router: Router, db: Database): void {
  router.post("/api/auth/verify-email", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as { token?: string } | null;
    if (!body?.token) {
      sendJson(res, 400, { error: "token is required" });
      return;
    }

    const tokenRow = await getValidVerificationToken(db, body.token);
    if (!tokenRow) {
      sendJson(res, 400, { error: "invalid or expired token" });
      return;
    }

    await markEmailVerified(db, tokenRow.userId);
    await markVerificationTokenUsed(db, body.token);
    sendJson(res, 200, { ok: true });
  });

  router.post("/api/auth/resend-verification", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as { email?: string } | null;
    if (!body?.email) {
      sendJson(res, 400, { error: "email is required" });
      return;
    }

    const user = await getUserByEmail(db, body.email.trim());
    if (user && !user.emailVerified) {
      try {
        const token = await createVerificationToken(db, user.id);
        const link = verificationLink(token);
        await sendEmail({
          to: user.email,
          subject: "Verify your email — SANDWICH",
          text: `Verifikasi email kamu: ${link}`,
          html: `<p>Klik link ini untuk verifikasi email:</p><p><a href="${link}">${link}</a></p>`,
        });
      } catch (err) {
        sendCaughtError(res, err, "resend verification");
        return;
      }
    }

    sendJson(res, 200, { ok: true });
  });
}
```

Update the import in `routes/auth.ts` to get `verificationLink` from `./email-verification.js`:

```typescript
import { verificationLink } from "./email-verification.js";
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/auth/service.ts apps/server/routes/auth.ts apps/server/routes/email-verification.ts
git commit -m "feat: email verification on register + login gate + verify/resend routes"
```

---

### Task 4: Wire routes into web-server

**Files:**
- Modify: `apps/server/web-server.ts`

- [ ] **Step 1: Register the routes + public paths**

Add the import:

```typescript
import { registerEmailVerificationRoutes } from "./routes/email-verification.js";
```

Add to `PUBLIC_API_PATHS`:

```typescript
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
```

Register (after `registerPasswordResetRoutes`):

```typescript
  registerEmailVerificationRoutes(router, db);
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
git add apps/server/web-server.ts
git commit -m "feat: wire email verification routes"
```

---

### Task 5: Frontend

**Files:**
- Modify: `apps/web/src/api/auth.ts`
- Modify: `apps/web/src/components/SetupForm.tsx`
- Modify: `apps/web/src/components/LoginForm.tsx`
- Create: `apps/web/src/components/VerifyEmailPage.tsx`
- Modify: `apps/web/src/components/AuthGate.tsx`
- Modify: `apps/web/src/lib/i18n.tsx`

- [ ] **Step 1: Add API client functions**

In `apps/web/src/api/auth.ts`, append:

```typescript
export async function postVerifyEmail(token: string): Promise<void> {
  await postJson(apiUrl('/api/auth/verify-email'), { token })
}

export async function postResendVerification(email: string): Promise<void> {
  await postJson(apiUrl('/api/auth/resend-verification'), { email })
}
```

- [ ] **Step 2: Add i18n keys**

In `apps/web/src/lib/i18n.tsx` (in the Forgot/Reset section), add:

```typescript
  setup_verify_sent_title: { en: 'Check your email', id: 'Cek email kamu' },
  setup_verify_sent_desc: { en: 'We sent a verification link. Click it to activate your account.', id: 'Kami kirim link verifikasi. Klik untuk aktivasi akun kamu.' },
  verify_title: { en: 'Verify email', id: 'Verifikasi email' },
  verify_success: { en: 'Your email is verified. You can log in now.', id: 'Email kamu terverifikasi. Kamu bisa login sekarang.' },
  verify_invalid: { en: 'This link is invalid or expired.', id: 'Link ini tidak valid atau sudah kadaluarsa.' },
  login_email_not_verified: { en: 'Email not verified yet. Check your inbox or resend.', id: 'Email belum terverifikasi. Cek inbox atau kirim ulang.' },
  login_resend: { en: 'Resend verification', id: 'Kirim ulang verifikasi' },
  resend_success: { en: 'If that email is registered and unverified, a new link has been sent.', id: 'Kalau email itu terdaftar & belum terverifikasi, link baru sudah dikirim.' },
```

- [ ] **Step 3: SetupForm — show "check your email" after register**

In `apps/web/src/components/SetupForm.tsx`:

Change the `onSubmit` prop type to return a promise:

```typescript
  onSubmit: (username: string, email: string, password: string) => Promise<unknown>;
```

Add state and make submit async:

```typescript
  const [registered, setRegistered] = useState(false);
```

Replace `handleSubmit`:

```typescript
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!username.trim() || !email.trim() || !password.trim()) return;
    try {
      await onSubmit(username.trim(), email.trim(), password);
      setRegistered(true);
    } catch {
      /* error surfaced via error prop */
    }
  };
```

Change `form onSubmit` to `onSubmit={handleSubmit}` (already does) — but ensure the submit button `type="submit"` still works with the async handler. It does.

Add, at the top of the returned JSX (before the card), a "registered" branch:

```tsx
  if (registered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
        <div className="w-full max-w-sm rounded-3xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
          <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('setup_verify_sent_title')}</h1>
          <p className="text-sm text-zinc-500 text-center mb-6">{tr('setup_verify_sent_desc')}</p>
          <button onClick={onBack} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: LoginForm — handle "email not verified" + resend**

In `apps/web/src/components/LoginForm.tsx`:

Add state:

```typescript
  const [resendEmail, setResendEmail] = useState('')
  const [resendSent, setResendSent] = useState(false)
  const [resending, setResending] = useState(false)
```

Add a resend handler:

```typescript
  const handleResend = async () => {
    if (!resendEmail.trim() || resending) return
    setResending(true)
    try {
      await postResendVerification(resendEmail.trim())
      setResendSent(true)
    } catch {
      /* ignore — keep it simple */
    } finally {
      setResending(false)
    }
  }
```

Import `postResendVerification`:

```typescript
import { postResendVerification } from '../api/auth'
```

In the error block, when `error === 'email not verified'`, show the message + resend UI. Replace the `{error && (...)}` block with:

```tsx
          {error === 'email not verified' ? (
            <div className="flex flex-col gap-2 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(249,24,20,0.08)' }}>
              <p style={{ color: '#f91814' }}>{tr('login_email_not_verified')}</p>
              {resendSent ? (
                <p style={{ color: '#16a34a' }}>{tr('resend_success')}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder={tr('forgot_email_placeholder')}
                    className="flex-1 bg-white rounded-lg px-2 py-1.5 outline-none"
                    style={{ color: '#111827', border: '1px solid rgba(0,0,0,0.1)' }}
                  />
                  <button type="button" onClick={handleResend} disabled={resending} className="shrink-0 px-2.5 py-1.5 rounded-lg font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>
                    {tr('login_resend')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            error && (
              <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>
                {error}
              </p>
            )
          )}
```

- [ ] **Step 5: Create VerifyEmailPage**

Create `apps/web/src/components/VerifyEmailPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../lib/i18n'
import { postVerifyEmail } from '../api/auth'

const bowlby = "'Bowlby One', system-ui"

export default function VerifyEmailPage() {
  const { t: tr } = useLanguage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setState('error'); return }
    postVerifyEmail(token)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#F4EBE1' }}>
      <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={{ backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
        <h1 className="text-2xl tracking-tight mb-4" style={{ fontFamily: bowlby, color: '#111827' }}>{tr('verify_title')}</h1>
        {state === 'loading' && <p className="text-sm text-zinc-500">Loading…</p>}
        {state === 'success' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }}>{tr('verify_success')}</p>
            <button onClick={() => navigate('/')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        )}
        {state === 'error' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#f91814', backgroundColor: 'rgba(249,24,20,0.08)' }}>{tr('verify_invalid')}</p>
            <button onClick={() => navigate('/')} className="w-full py-3 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#0a0a0a' }}>{tr('auth_back')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire the route in AuthGate**

In `apps/web/src/components/AuthGate.tsx`, add the import:

```typescript
import VerifyEmailPage from './VerifyEmailPage'
```

Add the route (next to the forgot/reset routes):

```typescript
  if (location.pathname.startsWith('/verify-email')) {
    return <VerifyEmailPage />
  }
```

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc -p tsconfig.json --noEmit
npm --prefix apps/web run typecheck
git add apps/web/src/api/auth.ts apps/web/src/components/SetupForm.tsx apps/web/src/components/LoginForm.tsx apps/web/src/components/VerifyEmailPage.tsx apps/web/src/components/AuthGate.tsx apps/web/src/lib/i18n.tsx
git commit -m "feat: email verification UI (check-email screen, verify page, login resend)"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full test suite + build**

```bash
npm test
npm run build
```

- [ ] **Step 2: Restart the server**

```bash
# kill the running tsx server, then:
npx tsx apps/server/web-server.ts
```

- [ ] **Step 3: Verify live**

```bash
# 1. Register a throwaway user
curl -s -X POST http://localhost:4319/api/auth/register -H "content-type: application/json" -d '{"username":"verifyflow","email":"verifyflow@etalas.com","password":"pass123"}'

# 2. Try login (expect 403 email not verified)
curl -s -X POST http://localhost:4319/api/auth/login -H "content-type: application/json" -d '{"username":"verifyflow","password":"pass123"}'

# 3. Read the verification token from the DB
psql -d sandwich -t -A -c "SELECT token FROM email_verification_tokens ORDER BY created_at DESC LIMIT 1;"

# 4. Verify email
curl -s -X POST http://localhost:4319/api/auth/verify-email -H "content-type: application/json" -d '{"token":"<TOKEN>"}'

# 5. Login again (expect success)
curl -s -X POST http://localhost:4319/api/auth/login -H "content-type: application/json" -d '{"username":"verifyflow","password":"pass123"}'
```

Expected: step 2 `{"error":"email not verified"}`, step 4 `{"ok":true}`, step 5 returns user + session.

- [ ] **Step 4: Cleanup test user + commit fixes**

```bash
# delete verifyflow + tokens
psql -d sandwich -c "DELETE FROM email_verification_tokens WHERE user_id=(SELECT id FROM users WHERE username='verifyflow'); DELETE FROM users WHERE username='verifyflow';"
git add -A && git commit -m "fix: e2e verification fixes"
```
