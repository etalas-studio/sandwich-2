# Email Verification Design

## Overview

Require new users to verify their email address before they can log in. Registration sends a one-time verification link (Resend); clicking it marks the email verified. Existing users are backfilled as verified.

## Scope

- Login is **blocked** until the email is verified (option A).
- Existing users are backfilled as **verified** (no lockout).
- Verification link expires in **24 hours**, single-use.
- After register, the user is **not auto-logged in** — they see a "check your email" screen.

## Backend

### Database

- Add `email_verified` boolean column to `users` (default `false`), then backfill existing rows to `true`.
- New table `email_verification_tokens` (`token` PK, `user_id` FK, `expires_at`, `used_at` nullable, `created_at`) — mirrors `password_reset_tokens`.

### Auth changes (`auth/service.ts`, `routes/auth.ts`)

- `register`: create user (unverified), create verification token, send email. **No session created**; returns `{ user, verificationPending: true }`.
- `login`: if `email_verified` is false → `403 { error: "email not verified" }`.

### New routes (`routes/email-verification.ts`, public)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/auth/verify-email` | `{ token }` → validate → mark user verified → mark token used → `{ ok: true }` |
| `POST` | `/api/auth/resend-verification` | `{ email }` → if user exists & unverified → new token + send email. Always `{ ok: true }` |

### Token repo (`db/repo/email-verifications.ts`)

`createVerificationToken`, `getValidVerificationToken`, `markVerificationTokenUsed` — same pattern as password resets.

## Frontend

- **SetupForm** — after successful register, show a "check your email" screen (inline) instead of logging in.
- **LoginForm** — on `email not verified` error, show message + inline "resend" (email input).
- **`/verify-email`** page — reads `token`, calls verify, on success redirects to login.
- **API client** — `postVerifyEmail`, `postResendVerification`.
- **i18n** — EN/ID strings.

## Env

Uses existing `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.

## Out of Scope

- Rate limiting on verify/resend.
- Auto-verification of existing users beyond the backfill.
