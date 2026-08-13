import { marked } from "marked";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export type ExportFormat = "pdf" | "md" | "doc";

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  doc: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const EXT: Record<ExportFormat, string> = {
  pdf: "pdf",
  md: "md",
  doc: "docx",
};

export function normalizeFormat(format: string | null | undefined): ExportFormat {
  if (format === "md" || format === "doc") return format;
  return "pdf";
}

export function sanitizeFilename(title: string, extension: string): string {
  const base = title
    .trim()
    .replace(/[^\w\-\s]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${base || "sandwich"}.${extension}`;
}

export function parseQueryParam(url: string | undefined, key: string): string | null {
  if (!url) return null;
  const query = url.split("?")[1];
  if (!query) return null;
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    if (k === key) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function flattenInline(tokens: any[] | undefined, runs: InlineRun[] = []): InlineRun[] {
  if (!tokens) return runs;
  for (const t of tokens) {
    if (t.type === "text" || t.type === "codespan") {
      runs.push({
        text: typeof t.text === "string" ? t.text : "",
        bold: false,
        italic: false,
        code: t.type === "codespan",
      });
    } else if (t.type === "strong" || t.type === "em") {
      const inner = flattenInline(t.tokens);
      for (const r of inner) {
        runs.push({
          text: r.text,
          bold: r.bold || t.type === "strong",
          italic: r.italic || t.type === "em",
          code: r.code,
        });
      }
    } else if (t.type === "link" || t.type === "del") {
      flattenInline(t.tokens, runs);
    } else if (t.type === "br") {
      runs.push({ text: "\n", bold: false, italic: false, code: false });
    } else if (Array.isArray(t.tokens)) {
      flattenInline(t.tokens, runs);
    }
  }
  return runs;
}

export function plainText(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

export async function exportDocument(
  content: string,
  format: ExportFormat,
): Promise<ExportResult> {
  if (format === "md") {
    return {
      buffer: Buffer.from(content, "utf-8"),
      mimeType: MIME.md,
      extension: EXT.md,
    };
  }

  const tokens = marked.lexer(content) as unknown as any[];

  if (format === "pdf") {
    return { buffer: await renderPdf(tokens), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  throw new Error("not implemented");
}

function addPdfRuns(
  doc: InstanceType<typeof PDFDocument>,
  runs: InlineRun[],
  baseFont = "Helvetica",
  baseSize = 11,
): void {
  for (const run of runs) {
    let font = baseFont;
    if (run.code) font = "Courier";
    else if (run.bold && run.italic) font = "Helvetica-BoldOblique";
    else if (run.bold) font = "Helvetica-Bold";
    else if (run.italic) font = "Helvetica-Oblique";
    doc.font(font).fontSize(baseSize).text(run.text, { continued: true });
  }
  doc.text("");
}

function blockToText(tokens: any[]): string {
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.type === "paragraph" || t.type === "heading") {
      parts.push(plainText(flattenInline(t.tokens)));
    } else if (t.type === "list") {
      for (const item of t.items ?? []) parts.push(plainText(flattenInline(item.tokens)));
    } else if (t.type === "code") {
      parts.push(typeof t.text === "string" ? t.text : "");
    } else if (t.type === "text") {
      parts.push(typeof t.text === "string" ? t.text : "");
    } else if (Array.isArray(t.tokens)) {
      parts.push(blockToText(t.tokens));
    } else if (typeof t.text === "string") {
      parts.push(t.text);
    }
  }
  return parts.join(" ");
}

function renderPdf(tokens: any[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  for (const token of tokens) {
    if (token.type === "heading") {
      const depth = token.depth ?? 1;
      const size = depth <= 1 ? 20 : depth === 2 ? 16 : 14;
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(size);
      doc.text(plainText(flattenInline(token.tokens)), { lineGap: 4 });
    } else if (token.type === "paragraph") {
      doc.moveDown(0.3);
      addPdfRuns(doc, flattenInline(token.tokens));
    } else if (token.type === "list") {
      doc.moveDown(0.3);
      let index = 1;
      for (const item of token.items ?? []) {
        const marker = token.ordered ? `${index}. ` : "\u2022 ";
        index += 1;
        doc.font("Helvetica").fontSize(11);
        doc.text(marker + plainText(flattenInline(item.tokens)), {
          indent: 12,
          lineGap: 2,
        });
      }
    } else if (token.type === "code") {
      doc.moveDown(0.3);
      doc.font("Courier").fontSize(9);
      doc.text(typeof token.text === "string" ? token.text : "", { lineGap: 2 });
    } else if (token.type === "blockquote") {
      doc.moveDown(0.3);
      doc.font("Helvetica-Oblique").fontSize(11);
      doc.text(blockToText(token.tokens ?? []), { indent: 16, lineGap: 2 });
    } else if (token.type === "hr") {
      doc.moveDown(0.5);
      doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
      doc.moveDown(0.5);
    } else if (token.type === "table") {
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      const rows = token.rows ?? [];
      for (const row of rows) {
        const cells = (row as any[]).map((c) => plainText(flattenInline(c?.tokens)));
        doc.text(cells.join("  |  "), { lineGap: 2 });
      }
    }
  }

  doc.end();
  return done.then(() => Buffer.concat(chunks));
}
