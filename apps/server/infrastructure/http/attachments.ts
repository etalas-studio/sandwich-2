import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import Busboy from "busboy";
import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
import { sendJson, sendCaughtError } from "../../http-utils.js";
import { authenticateRequest } from "../../auth/middleware.js";
import {
  makeStorageKey,
  uploadToStorage,
  storageConfigured,
  MAX_UPLOAD_BYTES,
} from "../../storage/r2.js";
import { createAttachment, listAttachments } from "../../db/repo/attachments.js";
import { getConversation } from "../../conversations/db.js";
import { processExtraction } from "../../attachments/extract.js";

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
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks),
        };
      });
    });

    bb.on("finish", () => {
      if (settled) return;
      if (!file) {
        reject(new Error("no file uploaded"));
      } else {
        resolve({ file, conversationId });
      }
    });

    bb.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.pipe(bb);
  });
}

function isAllowedFileType(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return true;
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf.length >= 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return true;
  if (buf.slice(0, 6).toString() === "GIF87a" || buf.slice(0, 6).toString() === "GIF89a") return true;
  return false;
}

export function registerAttachmentRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.post("/api/attachments", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    if (!storageConfigured()) {
      sendJson(res, 503, {
        error: "file storage not configured on this instance",
      });
      return;
    }

    try {
      const parsed = await parseUpload(req);
      if (!isAllowedFileType(parsed.file.buffer)) {
        sendJson(res, 415, { error: "file type not supported" });
        return;
      }

      const id = randomUUID();
      const storageKey = makeStorageKey(auth.userId, parsed.file.filename);
      await uploadToStorage(storageKey, parsed.file.buffer, parsed.file.mimeType);

      const attachment = await createAttachment(db, {
        id,
        userId: auth.userId,
        conversationId: parsed.conversationId,
        filename: parsed.file.filename,
        mimeType: parsed.file.mimeType,
        storageKey,
        sizeBytes: parsed.file.buffer.length,
      });

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
    const conv = await getConversation(db, params.id!);
    if (!conv || conv.userId !== auth.userId) {
      sendJson(res, 404, { error: "conversation not found" });
      return;
    }
    sendJson(res, 200, await listAttachments(db, params.id!));
  });
}
