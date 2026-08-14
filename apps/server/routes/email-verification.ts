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
