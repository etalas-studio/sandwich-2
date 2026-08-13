import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import Busboy from "busboy";
import type { Router } from "../router.js";
import { sendJson, sendCaughtError } from "../http-utils.js";
import type { Database } from "../db/connection.js";
import { authenticateRequest } from "../auth/middleware.js";
import {
  makeStorageKey,
  uploadToStorage,
  storageConfigured,
  MAX_UPLOAD_BYTES,
} from "../storage/r2.js";
import { createAttachment, listAttachments } from "../db/repo/attachments.js";
import { processExtraction } from "../pipeline/extract.js";

interface UploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

interface ParsedUpload {
  file: UploadedFile;
  conversationId: string | null;
}

function parseUpload(req: IncomingMessage): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
    });

    let settled = false;
    let file: UploadedFile | null = null;
    let conversationId: string | null = null;

    bb.on("field", (name, value) => {
      if (name === "conversationId" && typeof value === "string" && value) {
        conversationId = value;
      }
    });

    bb.on("file", (_name, stream, info) => {
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
          settled = true;
          reject(new Error("file too large (max 25 MB)"));
          stream.destroy();
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => {
        file = {
          filename: info.filename || "upload",
          mimeType: info.mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        };
      });
    });

    bb.on("filesLimit", () => {
      if (!settled) {
        settled = true;
        reject(new Error("only one file per request"));
      }
    });
    bb.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    bb.on("close", () => {
      if (!settled) {
        settled = true;
        if (!file) reject(new Error("no file provided"));
        else resolve({ file, conversationId });
      }
    });

    req.pipe(bb);
  });
}

export function registerAttachmentRoutes(router: Router, db: Database): void {
  router.post("/api/attachments", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    if (!storageConfigured()) {
      sendJson(res, 503, {
        error: "file storage is not configured on this instance",
      });
      return;
    }

    let parsed: ParsedUpload;
    try {
      parsed = await parseUpload(req);
    } catch (err) {
      sendCaughtError(res, err, "attachment upload");
      return;
    }

    try {
      const id = randomUUID();
      const storageKey = makeStorageKey(auth.userId, parsed.file.filename);
      await uploadToStorage(storageKey, parsed.file.buffer, parsed.file.mimeType);

      const attachment = await createAttachment(db, {
        id,
        userId: auth.userId,
        conversationId: parsed.conversationId,
        storageKey,
        filename: parsed.file.filename,
        mimeType: parsed.file.mimeType,
        sizeBytes: parsed.file.buffer.length,
      });

      // Extract content in the background (image/audio/pdf/docx -> text).
      void processExtraction(db, {
        id: attachment.id,
        storageKey,
        filename: parsed.file.filename,
        mimeType: parsed.file.mimeType,
      });

      sendJson(res, 201, attachment);
    } catch (err) {
      sendCaughtError(res, err, "attachment upload");
    }
  });

  router.get("/api/conversations/:id/attachments", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, await listAttachments(db, params.id!));
  });
}
