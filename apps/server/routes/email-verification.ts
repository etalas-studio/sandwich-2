import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { getUserByEmail, markEmailVerified } from "../db/users.js";
import {
  createVerificationToken,
  getValidVerificationToken,
  markVerificationTokenUsed,
} from "../db/repo/email-verifications.js";
import { sendEmail } from "../notifications/email.js";
import { createRateLimiter, clientIp } from "../auth/rate-limit.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { parseQueryParam } from "../pipeline/export.js";

const verifyLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const resendLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });
// Polled every few seconds by the "check your email" tab, so this needs
// enough headroom for a few minutes of polling without tripping.
const statusLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export function verificationLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

export function registerEmailVerificationRoutes(router: Router, db: Database): void {
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
      await markEmailVerified(tx as unknown as Database, tokenRow.userId);
      await markVerificationTokenUsed(tx as unknown as Database, body.token!);
    });
    sendJson(res, 200, { ok: true });
  });

  // Polled by the "check your email" tab so it can pick up verification
  // done from a link opened in a different tab, without a manual reload.
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
