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
import { sendEmail } from "../notifications/email.js";
import { createRateLimiter, clientIp } from "../auth/rate-limit.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";

const forgotLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
const resetLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

function resetLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

export function registerPasswordResetRoutes(router: Router, db: Database): void {
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
}
