import type { Router } from "../router.js";
import { sendJson } from "../http-utils.js";
import { getDocument, getDocumentFile, getLatestVersion, getVersion } from "../db/documents.js";
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

async function resolveVersionNo(
  db: Database,
  documentId: string,
  versionStr: string | null,
): Promise<number | null> {
  if (versionStr) {
    const n = Number.parseInt(versionStr, 10);
    return Number.isFinite(n) ? n : null;
  }
  // Serve the active (current) version, falling back to latest.
  const doc = await getDocument(db, documentId);
  if (doc?.currentVersionId) {
    const current = await getVersion(db, doc.currentVersionId);
    if (current) return current.versionNo;
  }
  const latest = await getLatestVersion(db, documentId);
  return latest?.versionNo ?? null;
}

function redirectTrailing(res: ServerResponseLike, location: string): boolean {
  res.writeHead(301, { location });
  res.end();
  return true;
}

// Minimal response type used by the handlers.
interface ServerResponseLike {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}

/**
 * Public prototype preview — serves a prototype document's files by document id
 * and version. `/p/{docId}/` → latest index.html; `/p/{docId}/v/{versionNo}/`
 * → that version's index.html.
 */
export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  // Latest index — /p/:docId/
  router.get("/p/:docId", async (req, res, params) => {
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith("/")) {
      redirectTrailing(res, `/p/${params.docId!}/`);
      return;
    }
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") { sendJson(res, 404, { error: "not found" }); return; }
    const versionNo = await resolveVersionNo(db, doc.id, null);
    if (!versionNo) { sendJson(res, 404, { error: "no files generated" }); return; }
    const indexFile = await getDocumentFile(db, doc.id, versionNo, "index.html");
    if (!indexFile) { sendJson(res, 404, { error: "index.html not found" }); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(indexFile.content);
  });

  // Versioned index — /p/:docId/v/:versionNo/
  router.get("/p/:docId/v/:versionNo", async (req, res, params) => {
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith("/")) {
      redirectTrailing(res, `/p/${params.docId!}/v/${params.versionNo!}/`);
      return;
    }
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") { sendJson(res, 404, { error: "not found" }); return; }
    const versionNo = await resolveVersionNo(db, doc.id, params.versionNo!);
    if (!versionNo) { sendJson(res, 404, { error: "version not found" }); return; }
    const indexFile = await getDocumentFile(db, doc.id, versionNo, "index.html");
    if (!indexFile) { sendJson(res, 404, { error: "index.html not found" }); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(indexFile.content);
  });

  // Versioned file — /p/:docId/v/:versionNo/:path
  router.get("/p/:docId/v/:versionNo/*path", async (_req, res, params) => {
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") { sendJson(res, 404, { error: "not found" }); return; }
    const versionNo = await resolveVersionNo(db, doc.id, params.versionNo!);
    if (!versionNo) { sendJson(res, 404, { error: "version not found" }); return; }
    const file = await getDocumentFile(db, doc.id, versionNo, params.path!);
    if (!file) { sendJson(res, 404, { error: "file not found" }); return; }
    res.writeHead(200, { "content-type": MIME[extFor(file.path)] ?? "application/octet-stream" });
    res.end(file.content);
  });

  // Latest file — /p/:docId/:path
  router.get("/p/:docId/*path", async (_req, res, params) => {
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") { sendJson(res, 404, { error: "not found" }); return; }
    const versionNo = await resolveVersionNo(db, doc.id, null);
    if (!versionNo) { sendJson(res, 404, { error: "no files generated" }); return; }
    const file = await getDocumentFile(db, doc.id, versionNo, params.path!);
    if (!file) { sendJson(res, 404, { error: "file not found" }); return; }
    res.writeHead(200, { "content-type": MIME[extFor(file.path)] ?? "application/octet-stream" });
    res.end(file.content);
  });
}
