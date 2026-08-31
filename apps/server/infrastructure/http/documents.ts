import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { authenticateRequest } from "../../auth/middleware.js";
import { sendJson, readJsonBody } from "../../http-utils.js";
import {
  exportDocument,
  normalizeFormat,
  sanitizeFilename,
  parseQueryParam,
  type ExportResult,
} from "../../documents/export.js";
import {
  findDocumentByTitle,
  getOwnedDocument,
  listDocumentsForUser,
  updateDocumentTitle,
  type Document,
} from "../../documents/db.js";
import { getProjectDir, resolveInsideProject } from "../../projects/workspace.js";

function withPreviewUrl(doc: Document) {
  if (doc.type !== "prototype") return { ...doc, previewUrl: null };
  const domain = process.env.PREVIEW_DOMAIN;
  return { ...doc, previewUrl: domain ? `https://${domain}/p/${doc.id}/` : `/p/${doc.id}/` };
}

async function readDocumentContent(
  userId: string,
  doc: Document,
): Promise<string | null> {
  const dir = await getProjectDir(userId, doc.projectId);
  let abs: string;
  try {
    abs = resolveInsideProject(dir, doc.relativePath);
  } catch {
    return null;
  }
  if (!existsSync(abs)) return null;
  return readFile(abs, "utf8");
}

export function registerDocumentRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.get("/api/documents", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const docs = await listDocumentsForUser(db, auth.userId);
    sendJson(
      res,
      200,
      docs.map((doc) => withPreviewUrl(doc)),
    );
  });

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
    sendJson(res, 200, withPreviewUrl(doc));
  });

  router.get("/api/documents/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, params.id!);
    if (!doc) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    const content = await readDocumentContent(auth.userId, doc);
    sendJson(res, 200, { ...withPreviewUrl(doc), content });
  });

  router.get("/api/documents/:id/export", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, params.id!);
    if (!doc) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    const content = await readDocumentContent(auth.userId, doc);
    if (content === null) {
      sendJson(res, 400, { error: "document has no content yet" });
      return;
    }
    const format = normalizeFormat(parseQueryParam(req.url, "format"));
    try {
      const result: ExportResult = await exportDocument(content, format);
      const filename = sanitizeFilename(doc.title, result.extension);
      res.writeHead(200, {
        "content-type": result.mimeType,
        "content-length": result.buffer.length,
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      });
      res.end(result.buffer);
    } catch {
      sendJson(res, 500, { error: "export failed" });
    }
  });

  router.patch("/api/documents/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, params.id!);
    if (!doc) {
      sendJson(res, 404, { error: "document not found" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as { title?: string } | null;
    if (!body?.title?.trim()) {
      sendJson(res, 400, { error: "title is required" });
      return;
    }
    await updateDocumentTitle(db, doc.id, body.title.trim());
    sendJson(res, 200, withPreviewUrl((await getOwnedDocument(db, auth.userId, doc.id))!));
  });
}
