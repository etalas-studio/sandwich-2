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
import { createRateLimiter, clientIp } from "../pipeline/rate-limit.js";
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
          subject: "Reset password SANDWICH",
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
