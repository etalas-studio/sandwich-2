# Password Reset (Email-based) Design

## Overview

Add a "forgot password" flow to the login page. Users who cannot log in submit their email, receive a one-time reset link by email, and set a new password. Email is sent via the **Resend REST API** (API key already present in `.env`).

## Scope

- Identifier: **email** (not username).
- Token expiry: **1 hour**, single-use.
- After reset: redirect to **login page** (no auto-login) with a success message.
- Reset link points to the web app at `${APP_URL}/reset-password?token=...`.

## Backend

### Database: `password_reset_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `token` | text PK | random `base64url` |
| `user_id` | text FK → users.id | |
| `expires_at` | timestamptz | now + 1h |
| `used_at` | timestamptz nullable | set on successful reset |
| `created_at` | timestamptz | |

### Email module: `apps/server/pipeline/email.ts`

`sendEmail({ to, subject, text, html })` → `fetch("https://api.resend.com/emails")` with `Authorization: Bearer ${RESEND_API_KEY}` and JSON body `{ from: EMAIL_FROM, to, subject, text, html }`.

Throws if `RESEND_API_KEY` or `EMAIL_FROM` is unset, or if the API returns non-2xx.

### `getUserByEmail`

Add to `apps/server/db/users.ts` (currently only `getUserByUsername` exists).

### Token repo: `apps/server/db/repo/password-resets.ts`

- `createResetToken(db, userId): Promise<string>` — `randomBytes(32).toString("base64url")`, expiry 1h.
- `getValidResetToken(db, token)` — returns row if exists, unexpired, unused.
- `markResetTokenUsed(db, token)` — set `used_at`.

### Routes: `apps/server/routes/password-reset.ts`

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `POST` | `/api/auth/forgot-password` | No | Body `{ email }`. Always returns `{ ok: true }` (anti-enumeration). If email matches a user: create token + send reset email. |
| `POST` | `/api/auth/reset-password` | No | Body `{ token, newPassword }`. Validate token → hash + update password → mark token used → delete the user's sessions → `{ ok: true }`. |

Both paths added to `PUBLIC_API_PATHS` in `web-server.ts` (or rely on the `/api/auth/*` auth-routes exemption — see implementation).

### Env

- `RESEND_API_KEY`, `EMAIL_FROM` — already present.
- `APP_URL` — new; base URL of the web app (default `http://localhost:3000`). Used to build the reset link.

## Frontend

- **LoginForm** — "Lupa password?" button below the password field → navigate `/forgot-password`.
- **`/forgot-password`** — email input → submit → success message ("if that email is registered, a reset link has been sent").
- **`/reset-password`** — reads `token` from URL query, new password + confirm inputs → submit → on success navigate to login.
- **API client** — `forgotPassword(email)`, `resetPassword(token, newPassword)` in `apps/web/src/api/auth.ts`.
- **i18n** — add EN/ID string keys for the new forms.

## Error Handling

| Case | Response / UX |
|------|---------------|
| Unknown email | `200 { ok: true }` (no email sent) |
| Invalid/expired/used token | `400` → "link invalid or expired, request again" |
| Email send failure | `500` (logged) |
| Missing fields | `400` |

## Out of Scope

- Rate limiting on forgot-password.
- Custom branded email template.
