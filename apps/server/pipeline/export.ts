import { marked } from "marked";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from "docx";

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
    if (t.type === "text" && Array.isArray(t.tokens)) {
      // marked wraps list-item inline content in an outer "text" token
      // whose real inline tokens (strong/em/etc.) live in t.tokens — recurse
      // into those instead of using the raw (still markdown-escaped) text.
      flattenInline(t.tokens, runs);
    } else if (t.type === "text" || t.type === "codespan") {
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

  return { buffer: await renderDocx(tokens), mimeType: MIME.doc, extension: EXT.doc };
}

function addPdfRuns(
  doc: InstanceType<typeof PDFDocument>,
  runs: InlineRun[],
  baseFont = "Helvetica",
  baseSize = 11,
): void {
  // pdfkit's `continued: true` chain undercounts the wrapped height of a
  // paragraph once it spans more than one styled run (e.g. plain text next
  // to **bold** text), leaving doc.y short of where the text actually
  // rendered. That causes the next block (often a heading) to be drawn on
  // top of the paragraph's last line. Measure the paragraph's real height
  // up front and force doc.y forward to at least that point afterward.
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const fullText = runs.map((r) => r.text).join("");
  const startY = doc.y;
  const expectedHeight = doc.font("Helvetica-Bold").fontSize(baseSize).heightOfString(fullText, {
    width: usableWidth,
  });

  for (const run of runs) {
    let font = baseFont;
    if (run.code) font = "Courier";
    else if (run.bold && run.italic) font = "Helvetica-BoldOblique";
    else if (run.bold) font = "Helvetica-Bold";
    else if (run.italic) font = "Helvetica-Oblique";
    doc.font(font).fontSize(baseSize).text(run.text, { continued: true });
  }
  doc.text("", { continued: false });

  const minY = startY + expectedHeight;
  if (doc.y < minY) doc.y = minY;
  doc.x = doc.page.margins.left;
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

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function inlineToTextRuns(tokens: any[] | undefined): TextRun[] {
  return flattenInline(tokens).map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold || undefined,
        italics: r.italic || undefined,
        font: r.code ? "Courier New" : undefined,
      }),
  );
}

async function renderDocx(tokens: any[]): Promise<Buffer> {
  const children: any[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const depth = Math.min(6, Math.max(1, token.depth ?? 1)) - 1;
      children.push(
        new Paragraph({
          heading: HEADING_LEVELS[depth],
          children: inlineToTextRuns(token.tokens),
        }),
      );
    } else if (token.type === "paragraph") {
      children.push(new Paragraph({ children: inlineToTextRuns(token.tokens) }));
    } else if (token.type === "list") {
      let index = 1;
      for (const item of token.items ?? []) {
        if (token.ordered) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${index}. `, bold: true }),
                ...inlineToTextRuns(item.tokens),
              ],
            }),
          );
          index += 1;
        } else {
          children.push(
            new Paragraph({ bullet: { level: 0 }, children: inlineToTextRuns(item.tokens) }),
          );
        }
      }
    } else if (token.type === "code") {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: typeof token.text === "string" ? token.text : "", font: "Courier New" })],
        }),
      );
    } else if (token.type === "blockquote") {
      children.push(
        new Paragraph({
          indent: { left: 720 },
          children: inlineToTextRuns(token.tokens),
        }),
      );
    } else if (token.type === "table") {
      const rows = token.rows ?? [];
      children.push(
        new Table({
          rows: rows.map(
            (row: any[]) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: inlineToTextRuns(cell?.tokens) })],
                    }),
                ),
              }),
          ),
        }),
      );
    } else if (token.type === "hr") {
      children.push(new Paragraph({ children: [new TextRun({ text: "---" })] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
