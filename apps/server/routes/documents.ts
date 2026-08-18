import type { Router } from "../router.js";
import type { ServerResponse } from "node:http";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, readJsonBody } from "../http-utils.js";
import {
  exportDocument,
  normalizeFormat,
  sanitizeFilename,
  parseQueryParam,
  type ExportResult,
} from "../pipeline/export.js";
import {
  findDocumentByTitle,
  getDocument,
  getLatestVersion,
  getLatestVersionNosForDocuments,
  getVersionNosByIds,
  listDocuments,
  listVersions,
  setDocumentCurrentVersion,
  updateDocumentTitle,
  type Document,
} from "../db/documents.js";
import type { Database } from "../db/connection.js";

function withPreviewUrl(doc: Document) {
  if (doc.type !== "prototype") return { ...doc, previewUrl: null };
  const domain = process.env.PREVIEW_DOMAIN;
  return { ...doc, previewUrl: domain ? `https://${domain}/p/${doc.id}/` : `/p/${doc.id}/` };
}

export function registerDocumentRoutes(router: Router, db: Database): void {
  // List the user's documents (title-scoped registry).
  router.get("/api/documents", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const docs = await listDocuments(db, auth.userId);
    const docIds = docs.map((d) => d.id);
    const pinnedVersionIds = docs.map((d) => d.currentVersionId).filter((id): id is string => !!id);
    const [latestNos, pinnedNos] = await Promise.all([
      getLatestVersionNosForDocuments(db, docIds),
      getVersionNosByIds(db, pinnedVersionIds),
    ]);
    const withMeta = docs.map((doc) => {
      const latestVersionNo = latestNos.get(doc.id) ?? null;
      const currentVersionNo = doc.currentVersionId
        ? (pinnedNos.get(doc.currentVersionId) ?? latestVersionNo)
        : latestVersionNo;
      return { ...withPreviewUrl(doc), latestVersionNo, currentVersionNo };
    });
    sendJson(res, 200, withMeta);
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
    sendJson(res, 200, { ...withPreviewUrl(doc), latestVersion: latest, versions });
  });

  // Export the latest version of a document as PDF/MD/DOC.
  router.get("/api/documents/:id/export", async (req, res, params) => {
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
    if (!latest) {
      sendJson(res, 400, { error: "document has no content yet" });
      return;
    }
    const format = normalizeFormat(parseQueryParam(req.url, "format"));
    try {
      const result: ExportResult = await exportDocument(latest.content, format);
      const filename = sanitizeFilename(doc.title, result.extension);
      res.writeHead(200, {
        "content-type": result.mimeType,
        "content-length": result.buffer.length,
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      });
      res.end(result.buffer);
    } catch (err) {
      sendJson(res, 500, { error: "export failed" });
    }
  });

  // Set a specific version as the active/current version (rollback).
  router.post("/api/documents/:id/rollback", async (req, res, params) => {
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
    const body = (await readJsonBody(req).catch(() => null)) as { versionNo?: number } | null;
    if (typeof body?.versionNo !== "number") {
      sendJson(res, 400, { error: "versionNo is required" });
      return;
    }
    const versions = await listVersions(db, doc.id);
    const target = versions.find((v) => v.versionNo === body.versionNo);
    if (!target) {
      sendJson(res, 404, { error: "version not found" });
      return;
    }
    await setDocumentCurrentVersion(db, doc.id, target.id);
    sendJson(res, 200, { currentVersionNo: target.versionNo });
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
