import type { ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getConversation } from "../db/conversations.js";
import { conversations as conversationsTable } from "../db/schema.js";
import { sendJson, sendCaughtError } from "../http-utils.js";
import {
  exportDocument,
  normalizeFormat,
  sanitizeFilename,
  parseQueryParam,
  type ExportResult,
} from "../pipeline/export.js";

function sendExport(res: ServerResponse, result: ExportResult, filename: string): void {
  res.writeHead(200, {
    "content-type": result.mimeType,
    "content-length": result.buffer.length,
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store",
  });
  res.end(result.buffer);
}

export function registerExportRoutes(router: Router, db: Database): void {
  // Authenticated — dashboard download.
  router.get("/api/conversations/:id/export", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    if (!conversation.output) {
      sendJson(res, 400, { error: "no output to export" });
      return;
    }

    const format = normalizeFormat(parseQueryParam(req.url, "format"));
    try {
      const result = await exportDocument(conversation.output, format);
      sendExport(
        res,
        result,
        sanitizeFilename(conversation.title || conversation.prompt || "sandwich", result.extension),
      );
    } catch (err) {
      sendCaughtError(res, err, "export");
    }
  });

  // Public — share page download (no auth; /api/share/* is exempt in middleware).
  router.get("/api/share/:token/export", async (req, res, params) => {
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.shareToken, params.token!))
      .limit(1);
    if (rows.length === 0) {
      sendJson(res, 404, { error: "share link not found" });
      return;
    }

    const conversation = rows[0]!;
    if (!conversation.output) {
      sendJson(res, 400, { error: "no output to export" });
      return;
    }

    const format = normalizeFormat(parseQueryParam(req.url, "format"));
    try {
      const result = await exportDocument(conversation.output, format);
      sendExport(res, result, sanitizeFilename(conversation.title || "sandwich", result.extension));
    } catch (err) {
      sendCaughtError(res, err, "export");
    }
  });
}
