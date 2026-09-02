import { createRequire } from "node:module";
import os from "node:os";
import mammoth from "mammoth";
import { downloadFromStorage } from "../storage/r2.js";
import type { Database } from "../db/connection.js";
import { setExtractionStatus } from "../db/repo/attachments.js";

// pdf-parse v1 runs a demo routine when imported as ESM (its `module.parent`
// is undefined), which tries to read a bundled test file and crashes. Load it
// through CJS require instead, where `module.parent` is set correctly.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (
  dataBuffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

/**
 * Attachment content extraction — turns a file into plain text that can be
 * injected into the AI's prompt. This is deliberately decoupled from the main
 * document-generation engine:
 *
 *   image → OpenCode Gemini vision (read text + describe layout),
 *           falling back to local OCR (tesseract.js)
 *   audio/video → not supported (transcription removed)
 *   pdf   → pdf-parse (text-based PDFs only)
 *   docx  → mammoth
 *   txt/md/json → raw utf-8
 *
 * The main engine (OpenCode/DeepSeek or Groq) only ever receives the
 * resulting text.
 */

// Vision runs through the configured vision engine (engine_settings);
// if it fails, fall back to local OCR.
const OCR_LANGS = process.env.OCR_LANGS ?? "eng";

const VISION_PROMPT =
  "Extract every piece of text in this image verbatim, then describe the layout, UI elements, and visual design in detail. If there is no text, just describe what you see.";

export interface ExtractResult {
  text: string;
}

export async function extractAttachmentText(input: {
  storageKey: string;
  filename: string;
  mimeType: string;
}): Promise<ExtractResult> {
  const { storageKey, filename, mimeType } = input;

  if (mimeType.startsWith("image/")) {
    return { text: await extractImage(storageKey, mimeType) };
  }
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    throw new Error(
      `Audio/video transcription is not available (${filename})`,
    );
  }
  if (mimeType === "application/pdf") {
    return { text: await extractPdf(storageKey) };
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return { text: await extractDocx(storageKey) };
  }
  if (isTextLike(mimeType)) {
    return { text: (await downloadFromStorage(storageKey)).toString("utf-8") };
  }
  throw new Error(`Unsupported attachment type: ${mimeType}`);
}

function isTextLike(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/xml" ||
    mimeType === "application/x-yaml" ||
    mimeType.includes("markdown")
  );
}

async function extractImageWithVision(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const { resolveModel } = await import("../model-runtime.js");
  const { runtime: rt, model } = await resolveModel("vision");

  const stream = rt.stream(model, {
    messages: [
      {
        role: "user",
        timestamp: Date.now(),
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image", data: buffer.toString("base64"), mimeType },
        ],
      },
    ],
  });

  const assistant = await stream.result();
  if (assistant.stopReason === "error" && assistant.errorMessage) {
    throw new Error(assistant.errorMessage);
  }
  const text = (assistant?.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("vision model returned no text");
  return text;
}

async function extractImageWithOcr(buffer: Buffer): Promise<string> {
  // Lazy import so the (large) OCR worker/wasm only loads when needed.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANGS, 1, {
    cachePath: `${os.tmpdir()}/spectr-tesseract`,
  });
  try {
    const { data } = await worker.recognize(buffer);
    const text = (data.text ?? "").trim();
    if (!text) throw new Error("No text found in image");
    return text;
  } finally {
    await worker.terminate();
  }
}

async function extractImage(
  storageKey: string,
  mimeType: string,
): Promise<string> {
  const buffer = await downloadFromStorage(storageKey);
  try {
    return await extractImageWithVision(buffer, mimeType);
  } catch (err) {
    console.warn(
      "OpenCode vision failed, falling back to OCR:",
      err instanceof Error ? err.message : err,
    );
    return await extractImageWithOcr(buffer);
  }
}

async function extractPdf(storageKey: string): Promise<string> {
  const buffer = await downloadFromStorage(storageKey);
  const parsed = await pdfParse(buffer);
  const text = (parsed.text ?? "").trim();
  if (!text) {
    throw new Error("No text found in PDF (scanned PDFs are not supported yet)");
  }
  return text;
}

async function extractDocx(storageKey: string): Promise<string> {
  const buffer = await downloadFromStorage(storageKey);
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (!text) throw new Error("No text found in DOCX");
  return text;
}

/** Full extraction lifecycle: processing -> extract -> done/failed. */
export async function processExtraction(
  db: Database,
  attachment: {
    id: string;
    storageKey: string;
    filename: string;
    mimeType: string;
  },
): Promise<void> {
  try {
    await setExtractionStatus(db, attachment.id, "processing");
    const { text } = await extractAttachmentText(attachment);
    await setExtractionStatus(db, attachment.id, "done", text);
  } catch (err) {
    console.error("attachment extraction failed:", err);
    await setExtractionStatus(db, attachment.id, "failed").catch(() => {});
  }
}
