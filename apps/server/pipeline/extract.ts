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
 *   image → Groq vision (read text + describe layout)
 *   audio → Groq Whisper transcription
 *   pdf   → pdf-parse (text-based PDFs only)
 *   docx  → mammoth
 *   txt/md/json → raw utf-8
 *
 * The main engine (OpenCode/DeepSeek or Groq) only ever receives the
 * resulting text.
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";
const TRANSCRIPTION_MODEL =
  process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3";
// Groq currently has no vision model, so images go through local OCR
// (tesseract.js) — text-only extraction, no layout description.
const OCR_LANGS = process.env.OCR_LANGS ?? "eng";

function groqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured");
  return key;
}

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
    return { text: await extractImage(storageKey) };
  }
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return { text: await transcribeAudio(storageKey, filename, mimeType) };
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

async function extractImage(storageKey: string): Promise<string> {
  const buffer = await downloadFromStorage(storageKey);
  // Lazy import so the (large) OCR worker/wasm only loads when needed.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANGS, 1, {
    cachePath: `${os.tmpdir()}/sandwich-tesseract`,
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

async function transcribeAudio(
  storageKey: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  const buffer = await downloadFromStorage(storageKey);
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mimeType }), filename);
  fd.append("model", TRANSCRIPTION_MODEL);
  fd.append("response_format", "json");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey()}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(
      `Groq transcription ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
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
