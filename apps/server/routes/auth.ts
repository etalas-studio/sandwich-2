import type { Router } from "../router.js";
import { AuthError, type AuthResult, login, logout, register } from "../auth/service.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getUserById, deleteUser } from "../db/users.js";
import { deleteSubscriptionByUser } from "../db/repo/subscriptions.js";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "../auth/cookie.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { createRateLimiter, clientIp } from "../pipeline/rate-limit.js";
import { createVerificationToken, deleteVerificationTokensByUser } from "../db/repo/email-verifications.js";
import { sendEmail } from "../pipeline/email.js";
import { verificationLink } from "./email-verification.js";
import type { Database } from "../db/connection.js";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";
const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });

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

export function registerAuthRoutes(
  router: Router,
  db: Database,
  publicPaths: Set<string>,
): void {
  router.get("/api/auth/me", async (_req, res) => {
    const auth = await authenticateRequest(db, _req);
    if (!auth) {
      sendJson(res, 200, { state: "unauthenticated" });
      return;
    }
    const user = await getUserById(db, auth.userId);
    sendJson(res, 200, { state: "authenticated", user: { id: user?.id ?? "", username: user?.username ?? "" } });
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
          subject: "Verify your email — SANDWICH",
          text: `Verifikasi email kamu: ${link}`,
          html: `<p>Klik link ini untuk verifikasi email:</p><p><a href="${link}">${link}</a></p>`,
        });
      } catch (err) {
        // Rollback the created user + token so a retry doesn't hit
        // "username already taken" (email failure shouldn't leave a half-registered user).
        // Delete in FK-safe order: verification tokens → subscription → user.
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
}
