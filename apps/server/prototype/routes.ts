import type { Router } from "../router.js";
import { sendJson } from "../http-utils.js";
import { getDocument, getDocumentFile } from "../db/documents.js";
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
 * Public prototype preview — serves a prototype document's files by document id.
 * `/p/{docId}/` → index.html; `/p/{docId}/{path}` → individual assets.
 */
export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  router.get("/p/:docId", async (req, res, params) => {
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith("/")) {
      res.writeHead(301, { location: `/p/${params.docId!}/` });
      res.end();
      return;
    }
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const indexFile = await getDocumentFile(db, doc.id, "index.html");
    if (!indexFile) {
      sendJson(res, 404, { error: "index.html not found" });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(indexFile.content);
  });

  router.get("/p/:docId/*path", async (_req, res, params) => {
    const doc = await getDocument(db, params.docId!);
    if (!doc || doc.type !== "prototype") {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const file = await getDocumentFile(db, doc.id, params.path!);
    if (!file) {
      sendJson(res, 404, { error: "file not found" });
      return;
    }
    res.writeHead(200, { "content-type": MIME[extFor(file.path)] ?? "application/octet-stream" });
    res.end(file.content);
  });
}
