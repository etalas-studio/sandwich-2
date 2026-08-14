import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, readJsonBody } from "../http-utils.js";
import {
  findDocumentByTitle,
  getDocument,
  getLatestVersion,
  listDocuments,
  listVersions,
  updateDocumentTitle,
} from "../db/documents.js";
import type { Database } from "../db/connection.js";

export function registerDocumentRoutes(router: Router, db: Database): void {
  // List the user's documents (title-scoped registry).
  router.get("/api/documents", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    sendJson(res, 200, await listDocuments(db, auth.userId));
  });

  // Look up a document by exact title ("buka PRD X").
  router.get("/api/documents/by-title/:title", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await findDocumentByTitle(db, auth.userId, params.title!);
    if (!doc) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    sendJson(res, 200, doc);
  });

  // Get a document with its latest version + full version history.
  router.get("/api/documents/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await getDocument(db, params.id!);
    if (!doc || doc.userId !== auth.userId) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    const latest = await getLatestVersion(db, doc.id);
    const versions = await listVersions(db, doc.id);
    sendJson(res, 200, { ...doc, latestVersion: latest, versions });
  });

  // Rename a document title (title is the retrieval key).
  router.patch("/api/documents/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await getDocument(db, params.id!);
    if (!doc || doc.userId !== auth.userId) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as { title?: string } | null;
    if (!body?.title?.trim()) {
      sendJson(res, 400, { error: "title is required" });
      return;
    }
    await updateDocumentTitle(db, doc.id, body.title.trim());
    sendJson(res, 200, await getDocument(db, doc.id));
  });
}
