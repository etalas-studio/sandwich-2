import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import type { Router, Request, Response } from "express";
import { getOwnedDocument } from "../documents/db.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getProjectDir, resolveInsideProject } from "../projects/workspace.js";
import type { Database } from "../db/connection.js";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function extFor(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

/**
 * Public prototype preview — serves the prototype document's files from the
 * project's git working tree. `/p/{docId}/` → `prototype/index.html`;
 * `/p/{docId}/{path}` → `prototype/{path}`. Versioned URLs (`/v/{sha}/`) arrive
 * with M4-01.
 */
export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  async function resolvePrototypeDir(
    req: Request,
    docId: string,
  ): Promise<{ dir: string; protoDir: string } | null> {
    const auth = await authenticateRequest(db, req);
    if (!auth) return null;
    const doc = await getOwnedDocument(db, auth.userId, docId);
    if (!doc || doc.type !== "prototype") return null;
    const dir = await getProjectDir(auth.userId, doc.projectId);
    return { dir, protoDir: posix.dirname(doc.relativePath) };
  }

  function serveFile(res: Response, dir: string, relPath: string): void {
    let abs: string;
    try {
      abs = resolveInsideProject(dir, relPath);
    } catch {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (!existsSync(abs)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(200).setHeader("content-type", MIME[extFor(abs)] ?? "application/octet-stream").end(readFileSync(abs));
  }

  // No trailing slash — redirect to canonical /p/:docId/
  router.get("/p/:docId", (req, res) => {
    res.redirect(301, `/p/${req.params.docId}/`);
  });

  // Latest index — /p/:docId/
  router.get("/p/:docId/", async (req, res) => {
    const resolved = await resolvePrototypeDir(req, req.params.docId);
    if (!resolved) { res.status(404).json({ error: "not found" }); return; }
    serveFile(res, resolved.dir, `${resolved.protoDir}/index.html`);
  });

  // Latest asset — /p/:docId/{*path}
  router.get("/p/:docId/{*path}", async (req, res) => {
    const resolved = await resolvePrototypeDir(req, req.params.docId);
    if (!resolved) { res.status(404).json({ error: "not found" }); return; }
    serveFile(res, resolved.dir, `${resolved.protoDir}/${req.params.path}`);
  });
}
