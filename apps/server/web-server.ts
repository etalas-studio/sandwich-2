import "dotenv/config";
import { createServer } from "node:http";
import type { Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { authenticateRequest } from "./auth/middleware.js";
import { MIME, sendJson } from "./http-utils.js";
import { Router } from "./router.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPasswordResetRoutes } from "./routes/password-reset.js";
import { registerEmailVerificationRoutes } from "./routes/email-verification.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerConversationRunRoutes } from "./routes/conversation-run.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerUsageRoutes } from "./routes/usage.js";
import { registerShareRoutes } from "./routes/share.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerMidtransRoutes } from "./routes/midtrans.js";
import { registerSubscriptionRoutes } from "./routes/subscriptions.js";
import { registerPreferenceRoutes } from "./routes/preferences.js";
import { resetStaleExtractions, listAttachmentsByStatus } from "./db/repo/attachments.js";
import { expireStalePayments } from "./db/payments.js";
import { processExtraction } from "./pipeline/extract.js";
import { registerPrototypePublicRoutes } from "./prototype/routes.js";
import { registerDocumentRoutes } from "./routes/documents.js";

export interface WebServerOptions {
  port: number;
  webRoot: string;
}

function parseTrustedHosts(): Set<string> {
  const hosts = new Set(
    (process.env.TRUSTED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost:3000");
  }
  return hosts;
}

const PUBLIC_API_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/midtrans/notification",
]);

export async function startWebServer(options: WebServerOptions): Promise<Server> {
  const { port, webRoot } = options;
  const db = await openDb(process.env.DATABASE_URL!);
  await resetStaleExtractions(db);
  await expireStalePayments(db);
  // Re-process attachments that were left pending (e.g. uploaded before the
  // extraction pipeline existed, or the server restarted mid-extraction).
  const pending = await listAttachmentsByStatus(db, "pending");
  for (const a of pending) {
    void processExtraction(db, a);
  }
  const trustedHosts = parseTrustedHosts();
  let boundPort = port;

  const router = new Router(trustedHosts, boundPort);

  router.use(async (req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const isApiPath = path === "/api" || path.startsWith("/api/");
    const isPublicShare = path.startsWith("/api/share/");
    if (isApiPath && !isPublicShare && !PUBLIC_API_PATHS.has(path)) {
      if (!(await authenticateRequest(db, req))) {
        sendJson(res, 401, { error: "unauthorized" });
        return false;
      }
    }
  });

  registerAuthRoutes(router, db, PUBLIC_API_PATHS);
  registerPasswordResetRoutes(router, db);
  registerEmailVerificationRoutes(router, db);
  registerIntegrationRoutes(router);
  registerConversationRoutes(router, db);
  registerConversationRunRoutes(router, db);
  registerAttachmentRoutes(router, db);
  registerUsageRoutes(router, db);
  registerShareRoutes(router, db);
  registerSettingsRoutes(router, db);
  registerMidtransRoutes(router, db);
  registerSubscriptionRoutes(router, db);
  registerPreferenceRoutes(router, db);
  registerPrototypePublicRoutes(router, db);
  registerDocumentRoutes(router, db);

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? "/";
        const path = url.split("?")[0] ?? "/";
        const isApiPath = path === "/api" || path.startsWith("/api/");
        const isPrototypePath = path === "/p" || path.startsWith("/p/");
        if (isApiPath || isPrototypePath) {
          await router.dispatch(req, res);
          return;
        }
        if (
          (req.method ?? "GET") === "GET" &&
          serveStatic(path, webRoot, res)
        )
          return;
        sendJson(res, 404, { error: "not found" });
      } catch (err) {
        console.error("unhandled request error:", err);
        res.headersSent
          ? res.destroy()
          : sendJson(res, 500, { error: "internal error" });
      }
    })();
  });

  server.listen(port, "0.0.0.0", () => {
    const address = server.address();
    boundPort =
      typeof address === "object" && address ? address.port : port;
  });

  return server;
}

function serveStatic(
  urlPath: string,
  webRoot: string,
  res: ServerResponse,
): boolean {
  if (!existsSync(webRoot)) return false;
  const relative =
    urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const target = resolve(webRoot, normalize(relative));
  if (!target.startsWith(resolve(webRoot))) return false;
  const file =
    existsSync(target) && !target.endsWith("/")
      ? target
      : join(webRoot, "index.html");
  if (!existsSync(file)) return false;
  const body = readFileSync(file);
  res.writeHead(200, {
    "content-type":
      MIME[extname(file)] ?? "application/octet-stream",
    "content-length": body.length,
  });
  res.end(body);
  return true;
}

if (
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`
) {
  startWebServer({
    port: process.env.PORT ? Number(process.env.PORT) : 4319,
    webRoot: process.env.WEB_ROOT ?? "apps/web/dist",
  }).catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}
