import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { authenticateRequest } from "../../auth/middleware.js";
import {
  exportDocument,
  normalizeFormat,
  sanitizeFilename,
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
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const docs = await listDocumentsForUser(db, auth.userId);
    res.status(200).json(docs.map((doc) => withPreviewUrl(doc)));
  });

  router.get("/api/documents/by-title/:title", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const doc = await findDocumentByTitle(db, auth.userId, req.params.title!);
    if (!doc) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    res.status(200).json(withPreviewUrl(doc));
  });

  router.get("/api/documents/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, req.params.id!);
    if (!doc) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    const content = await readDocumentContent(auth.userId, doc);
    res.status(200).json({ ...withPreviewUrl(doc), content });
  });

  router.get("/api/documents/:id/export", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, req.params.id!);
    if (!doc) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    const content = await readDocumentContent(auth.userId, doc);
    if (content === null) {
      res.status(400).json({ error: "document has no content yet" });
      return;
    }
    const format = normalizeFormat(String(req.query["format"] ?? ""));
    try {
      const result: ExportResult = await exportDocument(content, format);
      const filename = sanitizeFilename(doc.title, result.extension);
      res
        .status(200)
        .setHeader("content-type", result.mimeType)
        .setHeader("content-length", result.buffer.length)
        .setHeader("content-disposition", `attachment; filename="${filename}"`)
        .setHeader("cache-control", "no-store")
        .end(result.buffer);
    } catch {
      res.status(500).json({ error: "export failed" });
    }
  });

  router.patch("/api/documents/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const doc = await getOwnedDocument(db, auth.userId, req.params.id!);
    if (!doc) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    const body = req.body as { title?: string } | null;
    if (!body?.title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    await updateDocumentTitle(db, doc.id, body.title.trim());
    res.status(200).json(withPreviewUrl((await getOwnedDocument(db, auth.userId, doc.id))!));
  });
}
