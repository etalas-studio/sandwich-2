import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import {
  createPrototype,
  getPrototype,
  getPrototypeByShareId,
  listPrototypes,
  updatePrototypeBrief,
  getPrototypeFile,
  savePrototypeFile,
} from "./storage.js";
import { generatePrototype } from "./engine.js";
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

function previewUrlFor(shareId: string): string {
  const domain = process.env.PREVIEW_DOMAIN;
  if (domain) {
    return `https://${domain}/p/${shareId}/`;
  }
  return `/p/${shareId}/`;
}

function withPreviewUrl(proto: { id: string; userId: string; shareId: string; name: string; brief: string; logoData: string | null; palette: string | null; status: string; createdAt: string; updatedAt: string }) {
  return { ...proto, previewUrl: previewUrlFor(proto.shareId) };
}

function extFor(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function parseDataUrl(dataUrl: string): { ext: string; mime: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1]!;
  const ext = mime === "image/svg+xml" ? "svg" : mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  return { ext, mime, base64: match[2]! };
}

export function registerPrototypeRoutes(router: Router, db: Database): void {
  // Create prototype + kick off generation (background)
  router.post("/api/prototypes", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      name?: string;
      brief?: string;
      logoData?: string | null;
      palette?: string | null;
    } | null;

    if (!body || !body.name?.trim() || !body.brief?.trim()) {
      sendJson(res, 400, { error: "name and brief are required" });
      return;
    }

    let proto;
    try {
      proto = await createPrototype(db, {
        userId: auth.userId,
        name: body.name.trim(),
        brief: body.brief.trim(),
        logoData: body.logoData ?? null,
        palette: body.palette ?? null,
      });
    } catch (err) {
      sendCaughtError(res, err, "prototype creation");
      return;
    }

    // If logo is a base64 data URL, save it as a file the generated prototype can reference
    if (body.logoData?.startsWith("data:")) {
      const parsed = parseDataUrl(body.logoData);
      if (parsed) {
        // Store the full data URL so the serve route can decode it
        await savePrototypeFile(db, proto.id, `assets/logo.${parsed.ext}`, body.logoData);
      }
    }

    // Kick off generation in background (don't block response)
    generatePrototype(db, proto).catch((err) => {
      console.error("[prototype] generation failed:", err);
    });

    sendJson(res, 201, withPreviewUrl(proto));
  });

  // List prototypes
  router.get("/api/prototypes", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const protos = await listPrototypes(db, auth.userId);
    sendJson(res, 200, protos.map(withPreviewUrl));
  });

  // Get prototype
  router.get("/api/prototypes/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const proto = await getPrototype(db, params.id!);
    if (!proto) {
      sendJson(res, 404, { error: "prototype not found" });
      return;
    }
    sendJson(res, 200, withPreviewUrl(proto));
  });

  // Regenerate / iterate via chat
  router.post("/api/prototypes/:id/regenerate", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const proto = await getPrototype(db, params.id!);
    if (!proto) {
      sendJson(res, 404, { error: "prototype not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      instruction?: string;
    } | null;

    const updatedBrief = body?.instruction
      ? `${proto.brief}\n\n## Revision Request\n${body.instruction}`
      : proto.brief;

    await updatePrototypeBrief(db, proto.id, updatedBrief);

    const updated = (await getPrototype(db, proto.id))!;
    generatePrototype(db, updated).catch((err) => {
      console.error("[prototype] regeneration failed:", err);
    });

    sendJson(res, 200, { regenerating: true });
  });
}

export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  // Serve prototype index (public share link)
  router.get("/p/:shareId", async (req, res, params) => {
    // Redirect to trailing slash so relative paths (styles.css, script.js) resolve correctly
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith("/")) {
      res.writeHead(301, { location: `/p/${params.shareId!}/` });
      res.end();
      return;
    }
    const proto = await getPrototypeByShareId(db, params.shareId!);
    if (!proto) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const indexFile = await getPrototypeFile(db, proto.id, "index.html");
    if (!indexFile) {
      sendJson(res, 404, { error: "index.html not found" });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(indexFile.content);
  });

  // Serve individual prototype files (public)
  router.get("/p/:shareId/*path", async (_req, res, params) => {
    const proto = await getPrototypeByShareId(db, params.shareId!);
    if (!proto) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const file = await getPrototypeFile(db, proto.id, params.path!);
    if (!file) {
      sendJson(res, 404, { error: "file not found" });
      return;
    }

    // Handle base64 data URLs (uploaded logos/images stored inline)
    if (file.content.startsWith("data:")) {
      const parsed = parseDataUrl(file.content);
      if (parsed) {
        const buf = Buffer.from(parsed.base64, "base64");
        res.writeHead(200, { "content-type": parsed.mime, "content-length": buf.length });
        res.end(buf);
        return;
      }
    }

    res.writeHead(200, { "content-type": MIME[extFor(file.path)] ?? "application/octet-stream" });
    res.end(file.content);
  });
}
