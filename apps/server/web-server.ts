import "dotenv/config";
import type { Server } from "node:http";
import { closeRedis } from "./redis.js";
import { existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { projectsRoot } from "./projects/workspace.js";
import { openDb } from "./db/connection.js";
import { ensureAdminUser, getUserByEmail } from "./db/users.js";
import { subscriptions } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth/password.js";
import { authenticateRequest } from "./auth/middleware.js";
import { initIntegrations } from "./integrations/integrations.js";
import { sendJson } from "./http-utils.js";
import { resetStaleExtractions, listAttachmentsByStatus } from "./db/repo/attachments.js";
import { expireStalePayments } from "./db/payments.js";
import { processExtraction } from "./attachments/extract.js";
import { registerPrototypePublicRoutes } from "./prototype/routes.js";
import {
  registerAuthRoutes,
  registerConversationRoutes,
  registerGenerationRoutes,
  registerProjectRoutes,
  registerDocumentRoutes,
  registerBillingRoutes,
  registerAttachmentRoutes,
  registerShareRoutes,
  registerAccountRoutes,
  registerAdminRoutes,
} from "./infrastructure/http/index.js";
import type { HttpDeps } from "./infrastructure/http/types.js";
import {
  DrizzleConversationRepository,
  DrizzleDocumentRepository,
  DrizzleProjectRepository,
} from "./infrastructure/db/index.js";
import { PiGenerationAdapter } from "./infrastructure/ai/index.js";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { hostGuard, csrfGuard, corsMiddleware } from "./middleware/security.js";

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

/**
 * Seed the internal operator admin (idempotent). Password comes from
 * ADMIN_SEED_PASSWORD so it's never committed to source; ADMIN_SEED_EMAIL
 * defaults to the Etalas operator inbox.
 */
async function seedAdminUser(db: Awaited<ReturnType<typeof openDb>>): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL ?? "admin@sandwich.etalas.com";
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) {
    console.warn("[admin] ADMIN_SEED_PASSWORD not set — skipping admin seed");
    return;
  }
  const passwordHash = await hashPassword(password);
  const { created } = await ensureAdminUser(db, { email, passwordHash });

  // The operator admin is not a paying customer — give it a permanent,
  // unlimited "pro" subscription so the dashboard gate and quota checks
  // never block the operator from using (and testing) the app.
  const admin = await getUserByEmail(db, email);
  if (admin) {
    const now = new Date();
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, admin.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(subscriptions).values({
        userId: admin.id,
        planSlug: "pro",
        status: "active",
        periodDays: 30,
        expiresAt: null,
        startedAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(subscriptions)
        .set({ planSlug: "pro", status: "active", expiresAt: null, updatedAt: now })
        .where(eq(subscriptions.id, existing[0]!.id));
    }
  }

  if (created) console.log(`[admin] seeded admin account: ${email}`);
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

/**
 * Preconditions for the per-project git workspace (M1-05+):
 *  - `git` on PATH — every generation shells out to it. A WARNING, not fatal:
 *    the rest of the app (auth, billing, viewing) should stay up, and a
 *    generation attempt fails gracefully with a chat error (conversation-run).
 *  - `PROJECTS_ROOT` a mounted, writable dir in production — FATAL, because an
 *    ephemeral-disk fallback would silently lose every artifact on redeploy.
 */
function assertWorkspacePrereqs(): void {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    console.error(
      "WARNING: `git` is not on PATH. Document generation will fail until it is installed in the runtime image (see nixpacks.toml). The rest of the app still works.",
    );
  }

  const root = projectsRoot();
  if (process.env.NODE_ENV === "production" && !process.env.PROJECTS_ROOT) {
    console.error(
      `FATAL: PROJECTS_ROOT is not set. Falling back to ${root} on ephemeral disk would lose all generated artifacts on redeploy. Mount a volume and set PROJECTS_ROOT.`,
    );
    process.exit(1);
  }
  try {
    mkdirSync(root, { recursive: true });
    accessSync(root, constants.W_OK);
  } catch (err) {
    console.error(`FATAL: PROJECTS_ROOT (${root}) is not writable:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function startWebServer(options: WebServerOptions): Promise<Server> {
  const { port, webRoot } = options;
  assertWorkspacePrereqs();
  const db = await openDb(process.env.DATABASE_URL!);
  const deps: HttpDeps = {
    db,
    conversations: new DrizzleConversationRepository(db),
    documents: new DrizzleDocumentRepository(db),
    projects: new DrizzleProjectRepository(db),
    generation: new PiGenerationAdapter(),
  };
  await resetStaleExtractions(db);
  await expireStalePayments(db);
  // Re-process attachments that were left pending (e.g. uploaded before the
  // extraction pipeline existed, or the server restarted mid-extraction).
  const pending = await listAttachmentsByStatus(db, "pending");
  for (const a of pending) {
    void processExtraction(db, a);
  }
  // AI engine runtime (Pi SDK ModelRuntime + DB-backed credentials + 9router).
  await initIntegrations(db);
  await seedAdminUser(db);
  const trustedHosts = parseTrustedHosts();
  let boundPort = port;

  const app = express();

  // Middleware stack (order matters)
  app.use(corsMiddleware());
  app.use(hostGuard(trustedHosts, boundPort));
  app.use(csrfGuard(trustedHosts));
  app.use(express.json());

  // Auth guard — runs before route handlers
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const isApiPath = path === "/api" || path.startsWith("/api/");
    const isPublicShare = path.startsWith("/api/share/");
    if (isApiPath && !isPublicShare && !PUBLIC_API_PATHS.has(path)) {
      if (!(await authenticateRequest(db, req))) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }
    }
    next();
  });

  // Route registrations — TypeScript errors on these are expected; Task 4 updates
  // the register* signatures to accept Express Router instead of the custom Router.
  registerAuthRoutes(app as never, deps);
  registerConversationRoutes(app as never, deps);
  registerGenerationRoutes(app as never, deps);
  registerProjectRoutes(app as never, deps);
  registerDocumentRoutes(app as never, deps);
  registerBillingRoutes(app as never, deps);
  registerAttachmentRoutes(app as never, deps);
  registerShareRoutes(app as never, deps);
  registerAccountRoutes(app as never, deps);
  registerPrototypePublicRoutes(app as never, db);
  registerAdminRoutes(app as never, deps);

  // Static SPA serving
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot));
  }
  app.get("*", (req: Request, res: Response) => {
    const indexPath = resolve(webRoot, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "not found" });
    }
  });

  // Error handler (must have 4 params for Express to recognise it)
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error("unhandled request error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal error" });
  });

  const server = app.listen(port, "0.0.0.0", () => {
    const address = server.address();
    boundPort =
      typeof address === "object" && address ? address.port : port;
  });

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => {
      server.close(() => void closeRedis().finally(() => process.exit(0)));
    });
  }

  return server;
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
