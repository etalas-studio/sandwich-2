import type { Router } from "../../router.js";
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
import { sendJson, sendCaughtError, readJsonBody } from "../../http-utils.js";
import { createRateLimiter, clientIp } from "../../auth/rate-limit.js";
import {
  createVerificationToken,
  deleteVerificationTokensByUser,
  getValidVerificationToken,
  markVerificationTokenUsed,
} from "../../db/repo/email-verifications.js";
import { sendEmail } from "../../notifications/email.js";
import { deleteSessionsForUser } from "../../db/sessions.js";

function verificationLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}
import {
  createResetToken,
  getValidResetToken,
  markResetTokenUsed,
} from "../../db/repo/password-resets.js";
import { hashPassword } from "../../auth/password.js";
import { parseQueryParam } from "../../documents/export.js";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";
const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
const forgotLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
const resetLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const verifyLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const resendLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
const statusLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

function handleAuthRequest(
  res: import("node:http").ServerResponse,
  run: () => Promise<AuthResult>,
): void {
  run()
    .then((result) => {
      sendJson(
        res,
        200,
        { user: result.user },
        { "set-cookie": buildSessionCookie(result.session.token, COOKIE_SECURE) },
      );
    })
    .catch((err: unknown) => sendCaughtError(res, err, "auth request"));
}

function resetLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

export function registerAuthRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.get("/api/auth/me", async (_req, res) => {
    const auth = await authenticateRequest(db, _req);
    if (!auth) {
      sendJson(res, 200, { state: "unauthenticated" });
      return;
    }
    const user = await getUserById(db, auth.userId);
    sendJson(res, 200, { state: "authenticated", user: { id: user?.id ?? "", username: user?.username ?? "", email: user?.email ?? "", role: user?.role ?? "user" } });
  });

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
      try {
        await sendEmail({
          to: user.email,
          subject: "Satu langkah lagi — verifikasi email kamu di SANDWICH",
          text: `Hei, selamat datang di SANDWICH!\n\nKamu hampir selesai. Klik link berikut untuk verifikasi email dan mulai gunakan akun kamu:\n\n${link}\n\nLink ini berlaku selama 24 jam. Kalau kamu tidak mendaftar di SANDWICH, abaikan email ini saja.\n\n— Tim SANDWICH`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, selamat datang di SANDWICH! 👋</p>
  <p>Kamu hampir selesai. Klik tombol di bawah untuk verifikasi email dan mulai gunakan akun kamu.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Verifikasi Email Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 24 jam. Kalau kamu tidak mendaftar di SANDWICH, abaikan email ini saja.</p>
  <p style="color:#6b7280;font-size:13px">— Tim SANDWICH</p>
</div>`,
        });
      } catch (err) {
        await deleteVerificationTokensByUser(db, user.id).catch(() => {});
        await deleteSubscriptionByUser(db, user.id).catch(() => {});
        await deleteUser(db, user.id).catch(() => {});
        throw err;
      }

      sendJson(res, 201, {
        user: { id: user.id, username: user.username, email: user.email },
        verificationPending: true,
      });
    } catch (err) {
      sendCaughtError(res, err, "register");
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    if (!loginLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
    try {
      const body = (await readJsonBody(req)) as { username?: string; password?: string };
      if (!body.username || !body.password) {
        throw new AuthError(400, "username and password are required");
      }
      handleAuthRequest(res, () =>
        login(db, { username: body.username!, password: body.password! }),
      );
    } catch (err) {
      sendCaughtError(res, err, "login");
    }
  });

  router.post("/api/auth/logout", async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) await logout(db, token);
    res.writeHead(204, { "set-cookie": buildClearedSessionCookie(COOKIE_SECURE) });
    res.end();
  });

  // Password reset routes
  router.post("/api/auth/forgot-password", async (req, res) => {
    if (!forgotLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
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
          subject: "Reset password kamu — SANDWICH",
          text: `Hei, kami terima permintaan reset password untuk akun kamu.\n\nKlik link berikut untuk atur password baru:\n\n${link}\n\nLink ini berlaku selama 1 jam. Kalau kamu tidak meminta ini, abaikan saja email ini — password kamu tetap aman.\n\n— Tim SANDWICH`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, kami terima permintaan reset password untuk akun kamu.</p>
  <p>Klik tombol di bawah untuk atur password baru.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Reset Password Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 1 jam. Kalau kamu tidak meminta ini, abaikan saja email ini — password kamu tetap aman.</p>
  <p style="color:#6b7280;font-size:13px">— Tim SANDWICH</p>
</div>`,
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
    if (!resetLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
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

  // Email verification routes
  router.post("/api/auth/verify-email", async (req, res) => {
    if (!verifyLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
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

    await db.transaction(async (tx) => {
      await markEmailVerified(tx as unknown as typeof db, tokenRow.userId);
      await markVerificationTokenUsed(tx as unknown as typeof db, body.token!);
    });
    sendJson(res, 200, { ok: true });
  });

  router.get("/api/auth/verification-status", async (req, res) => {
    if (!statusLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
    const email = parseQueryParam(req.url, "email");
    if (!email) {
      sendJson(res, 400, { error: "email is required" });
      return;
    }
    const user = await getUserByEmail(db, email.trim());
    sendJson(res, 200, { verified: user?.emailVerified ?? false });
  });

  router.post("/api/auth/resend-verification", async (req, res) => {
    if (!resendLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: "too many requests, try again later" });
      return;
    }
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
          subject: "Ini link verifikasi baru kamu — SANDWICH",
          text: `Hei, ini link verifikasi baru yang kamu minta.\n\nKlik link berikut untuk verifikasi email dan aktifkan akun kamu:\n\n${link}\n\nLink ini berlaku selama 24 jam. Kalau kamu tidak merasa meminta ini, abaikan saja.\n\n— Tim SANDWICH`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <p>Hei, ini link verifikasi baru yang kamu minta.</p>
  <p>Klik tombol di bawah untuk verifikasi email dan aktifkan akun kamu.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f91814;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">Verifikasi Email Saya →</a></p>
  <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 24 jam. Kalau kamu tidak merasa meminta ini, abaikan saja.</p>
  <p style="color:#6b7280;font-size:13px">— Tim SANDWICH</p>
</div>`,
        });
      } catch (err) {
        sendCaughtError(res, err, "resend verification");
        return;
      }
    }

    sendJson(res, 200, { ok: true });
  });
}
