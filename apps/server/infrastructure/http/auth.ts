import type { Router } from "express";
import type { Response } from "express";
import type { HttpDeps } from "./types.js";
import { AuthError, type AuthResult, login, logout, register } from "../../auth/service.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { getUserById, deleteUser, getUserByEmail, updatePassword, markEmailVerified } from "../../db/users.js";
import { deleteSubscriptionByUser } from "../../db/repo/subscriptions.js";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "../../auth/cookie.js";
import { sendCaughtErrorExpress } from "../../http-utils.js";
import { createRateLimiter, clientIp } from "../../auth/rate-limit.js";
import {
  createVerificationToken,
  deleteVerificationTokensByUser,
  getValidVerificationToken,
  markVerificationTokenUsed,
} from "../../db/repo/email-verifications.js";
import { sendEmail } from "../../notifications/email.js";
import { deleteSessionsForUser } from "../../db/sessions.js";
import {
  createResetToken,
  getValidResetToken,
  markResetTokenUsed,
} from "../../db/repo/password-resets.js";
import { hashPassword } from "../../auth/password.js";

function verificationLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";
const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
const forgotLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
const resetLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const verifyLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const resendLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
const statusLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

function handleAuthRequest(
  res: Response,
  run: () => Promise<AuthResult>,
): void {
  run()
    .then((result) => {
      const cookie = buildSessionCookie(result.session.token, COOKIE_SECURE);
      res.setHeader("set-cookie", cookie).status(200).json({ user: result.user });
    })
    .catch((err: unknown) => sendCaughtErrorExpress(res, err, "auth request"));
}

export function registerAuthRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.get("/api/auth/me", async (_req, res) => {
    const auth = await authenticateRequest(db, _req);
    if (!auth) {
      res.status(200).json({ state: "unauthenticated" });
      return;
    }
    const user = await getUserById(db, auth.userId);
    res.status(200).json({ state: "authenticated", user: { id: user?.id ?? "", username: user?.username ?? "", email: user?.email ?? "", role: user?.role ?? "user" } });
  });

  router.post("/api/auth/register", async (req, res) => {
    try {
      const body = req.body as {
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
      try {
        await sendEmail({
          to: user.email,
          subject: "Satu langkah lagi — verifikasi email kamu di Spectr",
          text: `Hei, selamat datang di Spectr!\n\nKamu hampir selesai. Klik link berikut untuk verifikasi email dan mulai gunakan akun kamu:\n\n${link}\n\nLink ini berlaku selama 24 jam. Kalau kamu tidak mendaftar di Spectr, abaikan email ini saja.\n\n— Tim Spectr`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, selamat datang di Spectr! 👋</p>
  <p>Kamu hampir selesai. Klik tombol di bawah untuk verifikasi email dan mulai gunakan akun kamu.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Verifikasi Email Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 24 jam. Kalau kamu tidak mendaftar di Spectr, abaikan email ini saja.</p>
  <p style="color:#6b7280;font-size:13px">— Tim Spectr</p>
</div>`,
        });
      } catch (err) {
        await deleteVerificationTokensByUser(db, user.id).catch(() => {});
        await deleteSubscriptionByUser(db, user.id).catch(() => {});
        await deleteUser(db, user.id).catch(() => {});
        throw err;
      }

      res.status(201).json({
        user: { id: user.id, username: user.username, email: user.email },
        verificationPending: true,
      });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "register");
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    if (!loginLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    try {
      const body = req.body as { username?: string; password?: string };
      if (!body.username || !body.password) {
        throw new AuthError(400, "username and password are required");
      }
      handleAuthRequest(res, () =>
        login(db, { username: body.username!, password: body.password! }),
      );
    } catch (err) {
      sendCaughtErrorExpress(res, err, "login");
    }
  });

  router.post("/api/auth/logout", async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) await logout(db, token);
    res.status(204).setHeader("set-cookie", buildClearedSessionCookie(COOKIE_SECURE)).end();
  });

  // Password reset routes
  router.post("/api/auth/forgot-password", async (req, res) => {
    if (!forgotLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    const body = req.body as { email?: string } | null;
    if (!body?.email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const user = await getUserByEmail(db, body.email.trim());
    if (user) {
      try {
        const token = await createResetToken(db, user.id);
        const link = resetLink(token);
        await sendEmail({
          to: user.email,
          subject: "Reset password kamu — Spectr",
          text: `Hei, kami terima permintaan reset password untuk akun kamu.\n\nKlik link berikut untuk atur password baru:\n\n${link}\n\nLink ini berlaku selama 1 jam. Kalau kamu tidak meminta ini, abaikan saja email ini — password kamu tetap aman.\n\n— Tim Spectr`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, kami terima permintaan reset password untuk akun kamu.</p>
  <p>Klik tombol di bawah untuk atur password baru.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Reset Password Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 1 jam. Kalau kamu tidak meminta ini, abaikan saja email ini — password kamu tetap aman.</p>
  <p style="color:#6b7280;font-size:13px">— Tim Spectr</p>
</div>`,
        });
      } catch (err) {
        sendCaughtErrorExpress(res, err, "forgot password");
        return;
      }
    }

    // Always respond ok — do not reveal whether the email exists.
    res.status(200).json({ ok: true });
  });

  router.post("/api/auth/reset-password", async (req, res) => {
    if (!resetLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    const body = req.body as {
      token?: string;
      newPassword?: string;
    } | null;
    if (!body?.token || !body?.newPassword) {
      res.status(400).json({ error: "token and newPassword are required" });
      return;
    }

    const tokenRow = await getValidResetToken(db, body.token);
    if (!tokenRow) {
      res.status(400).json({ error: "invalid or expired token" });
      return;
    }

    const newHash = await hashPassword(body.newPassword);
    await updatePassword(db, tokenRow.userId, newHash);
    await markResetTokenUsed(db, body.token);
    await deleteSessionsForUser(db, tokenRow.userId);

    res.status(200).json({ ok: true });
  });

  // Email verification routes
  router.post("/api/auth/verify-email", async (req, res) => {
    if (!verifyLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    const body = req.body as { token?: string } | null;
    if (!body?.token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const tokenRow = await getValidVerificationToken(db, body.token);
    if (!tokenRow) {
      res.status(400).json({ error: "invalid or expired token" });
      return;
    }

    await db.transaction(async (tx) => {
      await markEmailVerified(tx as unknown as typeof db, tokenRow.userId);
      await markVerificationTokenUsed(tx as unknown as typeof db, body.token!);
    });
    res.status(200).json({ ok: true });
  });

  router.get("/api/auth/verification-status", async (req, res) => {
    if (!statusLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    const email = String(req.query["email"] ?? "");
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const user = await getUserByEmail(db, email.trim());
    res.status(200).json({ verified: user?.emailVerified ?? false });
  });

  router.post("/api/auth/resend-verification", async (req, res) => {
    if (!resendLimiter.check(clientIp(req))) {
      res.status(429).json({ error: "too many requests, try again later" });
      return;
    }
    const body = req.body as { email?: string } | null;
    if (!body?.email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const user = await getUserByEmail(db, body.email.trim());
    if (user && !user.emailVerified) {
      try {
        const token = await createVerificationToken(db, user.id);
        const link = verificationLink(token);
        await sendEmail({
          to: user.email,
          subject: "Ini link verifikasi baru kamu — Spectr",
          text: `Hei, ini link verifikasi baru yang kamu minta.\n\nKlik link berikut untuk verifikasi email dan aktifkan akun kamu:\n\n${link}\n\nLink ini berlaku selama 24 jam. Kalau kamu tidak merasa meminta ini, abaikan saja.\n\n— Tim Spectr`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, ini link verifikasi baru yang kamu minta.</p>
  <p>Klik tombol di bawah untuk verifikasi email dan aktifkan akun kamu.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Verifikasi Email Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 24 jam. Kalau kamu tidak merasa meminta ini, abaikan saja.</p>
  <p style="color:#6b7280;font-size:13px">— Tim Spectr</p>
</div>`,
        });
      } catch (err) {
        sendCaughtErrorExpress(res, err, "resend verification");
        return;
      }
    }

    res.status(200).json({ ok: true });
  });
}
