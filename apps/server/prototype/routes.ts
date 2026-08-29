import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import type { Router } from "../router.js";
import { sendJson } from "../http-utils.js";
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

interface ServerResponseLike {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string | Buffer): void;
}

function redirectTrailing(res: ServerResponseLike, location: string): boolean {
  res.writeHead(301, { location });
  res.end();
  return true;
}

/**
 * Public prototype preview — serves the prototype document's files from the
 * project's git working tree. `/p/{docId}/` → `prototype/index.html`;
 * `/p/{docId}/{path}` → `prototype/{path}`. Versioned URLs (`/v/{sha}/`) arrive
 * with M4-01.
 */
export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  async function resolvePrototypeDir(
    req: Parameters<Parameters<Router["get"]>[1]>[0],
    docId: string,
  ): Promise<{ dir: string; protoDir: string } | null> {
    const auth = await authenticateRequest(db, req);
    if (!auth) return null;
    const doc = await getOwnedDocument(db, auth.userId, docId);
    if (!doc || doc.type !== "prototype") return null;
    const dir = await getProjectDir(auth.userId, doc.projectId);
    return { dir, protoDir: posix.dirname(doc.relativePath) };
  }

  function serveFile(res: ServerResponseLike, dir: string, relPath: string): void {
    let abs: string;
    try {
      abs = resolveInsideProject(dir, relPath);
    } catch {
      sendJson(res as never, 404, { error: "not found" });
      return;
    }
    if (!existsSync(abs)) {
      sendJson(res as never, 404, { error: "not found" });
      return;
    }
    res.writeHead(200, { "content-type": MIME[extFor(abs)] ?? "application/octet-stream" });
    res.end(readFileSync(abs));
  }

  // Latest index — /p/:docId/
  router.get("/p/:docId", async (req, res, params) => {
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith("/")) {
      redirectTrailing(res, `/p/${params.docId!}/`);
      return;
    }
    const resolved = await resolvePrototypeDir(req, params.docId!);
    if (!resolved) { sendJson(res, 404, { error: "not found" }); return; }
    serveFile(res, resolved.dir, `${resolved.protoDir}/index.html`);
  });

  // Latest asset — /p/:docId/:path
  router.get("/p/:docId/*path", async (req, res, params) => {
    const resolved = await resolvePrototypeDir(req, params.docId!);
    if (!resolved) { sendJson(res, 404, { error: "not found" }); return; }
    serveFile(res, resolved.dir, `${resolved.protoDir}/${params.path!}`);
  });
}
