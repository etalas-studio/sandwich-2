import { marked } from "marked";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType } from "docx";
import { fileURLToPath } from "node:url";

export type ExportFormat = "pdf" | "md" | "doc";

/**
 * Only "quotation" gets the branded Etalas letterhead (logo, gradient
 * ribbon, office address, cover page). Every other document type renders
 * with the plain, unbranded layout — matching how Etalas' own PRDs and the
 * client's other reference documents look.
 */
export type ExportDocKind = "quotation" | "other";

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
  color?: string;
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

export function normalizeDocKind(type: string | null | undefined): ExportDocKind {
  return type === "quotation" ? "quotation" : "other";
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
      // A raw "text" token can contain incidental newlines from soft line
      // wraps in the source markdown (a single \n mid-paragraph, as opposed
      // to an explicit "br" token). Those are prose, not intentional line
      // breaks — CommonMark renders them as a space. If left as literal \n,
      // pdfkit's continued-text mode silently drops them, jamming adjacent
      // runs together (e.g. "MobileVersi:" instead of "Mobile\nVersi:").
      const raw = typeof t.text === "string" ? t.text : "";
      runs.push({
        text: t.type === "text" ? raw.replace(/\n/g, " ") : raw,
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

/**
 * A markdown list item's `tokens` array holds an inline-text wrapper token
 * first, followed by any nested block content (most commonly a nested
 * "list" token for sub-bullets). flattenInline only understands inline
 * tokens, so without this split, nested list content is silently dropped.
 */
export function splitListItem(item: any): { inline: any[]; nestedLists: any[] } {
  const itemTokens: any[] = item?.tokens ?? [];
  const first = itemTokens[0];
  const inline =
    first && (first.type === "text" || first.type === "paragraph") && Array.isArray(first.tokens)
      ? first.tokens
      : itemTokens.filter((t) => t.type !== "list");
  const nestedLists = itemTokens.filter((t) => t.type === "list");
  return { inline, nestedLists };
}

/**
 * Splits a run of inline text into separate "lines" at every bold-run
 * boundary. The doc metadata block the model writes right after the title
 * (e.g. "**Project Name:** X\n**Version:** 1.0 ...") is a single markdown
 * paragraph, so without this it renders as one run-on line or sentence —
 * every reference document instead puts each "**Label:** value" pair on
 * its own line.
 */
export function splitMetadataLines(runs: InlineRun[]): InlineRun[][] {
  const lines: InlineRun[][] = [];
  let current: InlineRun[] = [];
  runs.forEach((r, i) => {
    const prev = runs[i - 1];
    const startsNewField = r.bold && (!prev || !prev.bold) && current.length > 0;
    if (startsNewField) {
      lines.push(current);
      current = [];
    }
    current.push(r);
  });
  if (current.length) lines.push(current);
  return lines;
}

function metadataLineToLabelValue(line: InlineRun[]): { label: string; value: string } {
  const label = line
    .filter((r) => r.bold)
    .map((r) => r.text)
    .join("")
    .replace(/:\s*$/, "")
    .trim();
  const value = line
    .filter((r) => !r.bold)
    .map((r) => r.text)
    .join("")
    .trim();
  return { label, value };
}

export async function exportDocument(
  content: string,
  format: ExportFormat,
  docKind: ExportDocKind = "other",
): Promise<ExportResult> {
  if (format === "md") {
    return {
      buffer: Buffer.from(content, "utf-8"),
      mimeType: MIME.md,
      extension: EXT.md,
    };
  }

  // marked inserts "space" tokens between every block for blank lines —
  // they carry no rendering info and just complicate index-based lookups
  // (e.g. "is the token right after the title heading the metadata
  // paragraph?"), so drop them once up front.
  const tokens = (marked.lexer(content) as unknown as any[]).filter((t) => t.type !== "space");

  if (format === "pdf") {
    return { buffer: await renderPdf(tokens, docKind), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  return { buffer: await renderDocx(tokens, docKind), mimeType: MIME.doc, extension: EXT.doc };
}

const COLORS = {
  text: "#1f2328",
  muted: "#6b7280",
  rule: "#d0d5dd",
  tableHeaderFill: "#f3f4f6",
  quotationBlue: "#2554c7",
  quotationHeaderFill: "#dbe4f7",
};

const LOGO_PATH = fileURLToPath(new URL("./assets/etalas-logo.png", import.meta.url));

/**
 * Renders a line of styled inline runs (bold/italic/code, each optionally
 * colored) with an optional left indent — used for both paragraphs and list
 * items so both get real inline formatting instead of flattened plain text.
 *
 * pdfkit's `continued: true` chain undercounts the wrapped height of a line
 * once it spans more than one styled run (e.g. plain text next to **bold**
 * text), leaving doc.y short of where the text actually rendered — the next
 * block then draws on top of this line's last row. Measure the real height
 * up front and force doc.y forward to at least that point afterward.
 *
 * A run's text may also contain a literal "\n" for an intentional hard
 * break (markdown `br` token) — pdfkit's continued mode silently drops a
 * bare "\n" instead of breaking the line, so each run is split on "\n" and
 * rendered as separate continued segments joined by an explicit line break.
 */
function renderRuns(
  doc: InstanceType<typeof PDFDocument>,
  runs: InlineRun[],
  opts: { baseSize?: number; indent?: number; color?: string } = {},
): void {
  const baseSize = opts.baseSize ?? 11;
  const indent = opts.indent ?? 0;
  const defaultColor = opts.color ?? COLORS.text;

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - indent;
  const fullText = runs.map((r) => r.text).join("");
  const startY = doc.y;
  const startPage = doc.page;
  const expectedHeight = doc.font("Helvetica-Bold").fontSize(baseSize).heightOfString(fullText, {
    width: usableWidth,
  });

  let firstSegment = true;
  for (const run of runs) {
    let font = "Helvetica";
    if (run.code) font = "Courier";
    else if (run.bold && run.italic) font = "Helvetica-BoldOblique";
    else if (run.bold) font = "Helvetica-Bold";
    else if (run.italic) font = "Helvetica-Oblique";
    doc.font(font).fontSize(baseSize).fillColor(run.color ?? defaultColor);

    const parts = run.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      if (part) {
        doc.text(part, { continued: true, ...(firstSegment ? { indent } : {}) });
        firstSegment = false;
      }
      if (i < parts.length - 1) doc.text("", { continued: false });
    }
  }
  doc.fillColor(defaultColor).text("", { continued: false });

  // The continued-text undercount happens regardless of whether a page
  // break occurred mid-render — pdfkit still needs correcting either way.
  // If we're still on the same page, anchor the correction to where this
  // line started (startY). If pdfkit decided the line didn't fit and
  // pushed the whole render onto a fresh page, it reset y to that new
  // page's top margin before drawing — anchor to that instead, since
  // startY is now meaningless (it's a coordinate on the old page).
  const anchorY = doc.page === startPage ? startY : doc.page.margins.top;
  const minY = anchorY + expectedHeight;
  if (doc.y < minY) doc.y = minY;
  doc.x = doc.page.margins.left;
  doc.fillColor(COLORS.text);
}

function blockToText(tokens: any[]): string {
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.type === "paragraph" || t.type === "heading") {
      parts.push(plainText(flattenInline(t.tokens)));
    } else if (t.type === "list") {
      for (const item of t.items ?? []) {
        const { inline, nestedLists } = splitListItem(item);
        parts.push(plainText(flattenInline(inline)));
        for (const nested of nestedLists) parts.push(blockToText([nested]));
      }
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

function renderPdfList(doc: InstanceType<typeof PDFDocument>, listToken: any, depth = 0): void {
  const items = listToken.items ?? [];
  let index = 1;
  const indent = 14 + depth * 16;
  for (const item of items) {
    const { inline, nestedLists } = splitListItem(item);
    // "◦" isn't in pdfkit's default WinAnsi encoding and renders as garbage,
    // so nested bullets fall back to a plain hyphen instead.
    const marker = listToken.ordered ? `${index}. ` : depth > 0 ? "-  " : "•  ";
    index += 1;
    const runs: InlineRun[] = [
      { text: marker, bold: false, italic: false, code: false, color: COLORS.text },
      ...flattenInline(inline),
    ];
    renderRuns(doc, runs, { indent });
    for (const nested of nestedLists) {
      doc.moveDown(0.1);
      renderPdfList(doc, nested, depth + 1);
    }
    if (item !== items[items.length - 1]) doc.moveDown(0.12);
  }
}

/**
 * Draws a real bordered/gridded table (marked keeps the header row separate
 * from the body rows in `token.header` / `token.rows`) instead of joining
 * cells with "|" as plain text. Cell content is flattened to plain text —
 * rich inline formatting inside table cells is dropped, a small, accepted
 * trade-off for correct grid/border/page-break rendering. Handles rows that
 * don't fit on the remaining page by starting a fresh page and redrawing
 * the header row there, same as the reference documents do.
 */
function renderPdfTable(
  doc: InstanceType<typeof PDFDocument>,
  tableToken: any,
  opts: { headerFill: string },
): void {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const header: string[] = (tableToken.header ?? []).map((c: any) => plainText(flattenInline(c?.tokens)));
  const bodyRows: string[][] = (tableToken.rows ?? []).map((row: any[]) =>
    row.map((c) => plainText(flattenInline(c?.tokens))),
  );
  if (header.length === 0) return;

  const colCount = header.length;
  const cellPadding = 6;
  const minColWidth = 50;
  const maxLens = header.map((h) => h.length);
  for (const row of bodyRows) {
    row.forEach((cell, i) => {
      maxLens[i] = Math.max(maxLens[i] ?? 1, Math.min(cell.length, 60));
    });
  }
  const totalLen = maxLens.reduce((a, b) => a + b, 0) || colCount;
  const colWidths = maxLens.map((len) => Math.max(minColWidth, (len / totalLen) * usableWidth));
  // Rescale so columns sum exactly to usableWidth (minColWidth flooring can
  // push the raw proportional sum over/under).
  const rawSum = colWidths.reduce((a, b) => a + b, 0);
  const scale = usableWidth / rawSum;
  const finalWidths = colWidths.map((w) => w * scale);

  function rowHeight(cells: string[], bold: boolean): number {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    let maxH = 0;
    cells.forEach((text, i) => {
      const w = (finalWidths[i] ?? minColWidth) - cellPadding * 2;
      maxH = Math.max(maxH, doc.heightOfString(text, { width: w }));
    });
    return maxH + cellPadding * 2;
  }

  function drawRow(cells: string[], y: number, h: number, bold: boolean, fill?: string): void {
    let x = doc.page.margins.left;
    if (fill) doc.rect(x, y, usableWidth, h).fill(fill);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    cells.forEach((text, i) => {
      const w = finalWidths[i] ?? minColWidth;
      doc.strokeColor(COLORS.rule).lineWidth(0.5).rect(x, y, w, h).stroke();
      // doc.text() with explicit x/y still mutates doc.y as a side effect
      // (as if it were flowing text) — every row-advance below sets doc.y
      // explicitly from the row's own start position rather than doc.y
      // itself, so that side effect can't accumulate into extra gaps.
      doc
        .fillColor(COLORS.text)
        .text(text, x + cellPadding, y + cellPadding, { width: w - cellPadding * 2 });
      x += w;
    });
  }

  const headerH = rowHeight(header, true);

  function ensureSpace(h: number): void {
    const maxY = doc.page.height - doc.page.margins.bottom;
    if (doc.y + h > maxY) {
      doc.addPage();
      const y = doc.y;
      drawRow(header, y, headerH, true, opts.headerFill);
      doc.y = y + headerH;
    }
  }

  const headerY = doc.y;
  drawRow(header, headerY, headerH, true, opts.headerFill);
  doc.y = headerY + headerH;

  for (const row of bodyRows) {
    const h = rowHeight(row, false);
    ensureSpace(h);
    const rowY = doc.y;
    drawRow(row, rowY, h, false);
    doc.y = rowY + h;
  }
  doc.x = doc.page.margins.left;
}

function drawThinRule(doc: InstanceType<typeof PDFDocument>): void {
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(1)
    .strokeColor(COLORS.rule)
    .stroke();
}

/** Draws the Etalas letterhead (gradient ribbon, logo, office address) at the top of the current page. */
function drawQuotationHeader(doc: InstanceType<typeof PDFDocument>): void {
  const gradient = doc.linearGradient(0, 0, doc.page.width, 0);
  gradient.stop(0, "#eaf2ff").stop(0.5, "#5b93f5").stop(1, "#1d4ed8");
  doc.rect(0, 0, doc.page.width, 7).fill(gradient);

  try {
    doc.image(LOGO_PATH, doc.page.margins.left, 32, { width: 90 });
  } catch {
    // Missing/unreadable logo asset shouldn't fail the whole export.
  }

  const addressX = doc.page.width - doc.page.margins.right - 220;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted);
  doc.text("Office", addressX, 32, { width: 220, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
  doc.text("Artha Graha, Lt.2 Unit 2601 SCBD, Jl. Jend. Sudirman 52-52", addressX, 44, {
    width: 220,
    align: "right",
  });
  doc.text("Jakarta (etalas.com)", addressX, 56, { width: 220, align: "right" });
  doc.fillColor(COLORS.text);
}

/** Renders the quotation cover page: eyebrow label, title, optional subtitle, metadata table. */
function renderQuotationCover(
  doc: InstanceType<typeof PDFDocument>,
  titleText: string,
  subtitleText: string | null,
  metaLines: InlineRun[][],
): void {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.y = 260;
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.text);
  doc.text("COMMERCIAL QUOTATION", doc.page.margins.left, doc.y, { width: usableWidth, align: "center" });

  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(26).fillColor(COLORS.text);
  doc.text(titleText, doc.page.margins.left, doc.y, { width: usableWidth, align: "center" });

  if (subtitleText) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Oblique").fontSize(13).fillColor(COLORS.muted);
    doc.text(subtitleText, doc.page.margins.left, doc.y, { width: usableWidth, align: "center" });
  }

  doc.moveDown(2);
  doc.x = doc.page.margins.left;

  const pairs = metaLines.map(metadataLineToLabelValue).filter((p) => p.label);
  const labelWidth = 150;
  const rowPadding = 8;
  pairs.forEach((pair, i) => {
    doc.font("Helvetica-Bold").fontSize(10.5);
    const h =
      Math.max(
        doc.heightOfString(pair.label, { width: labelWidth - rowPadding * 2 }),
        doc.font("Helvetica").fontSize(10.5).heightOfString(pair.value, { width: usableWidth - labelWidth - rowPadding * 2 }),
      ) +
      rowPadding * 2;
    const y = doc.y;
    if (i % 2 === 0) doc.rect(doc.page.margins.left, y, usableWidth, h).fill("#f7f8fa");
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.text);
    doc.text(pair.label, doc.page.margins.left + rowPadding, y + rowPadding, { width: labelWidth - rowPadding * 2 });
    doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text);
    doc.text(pair.value, doc.page.margins.left + labelWidth, y + rowPadding, {
      width: usableWidth - labelWidth - rowPadding,
    });
    doc.y = y + h;
    doc.x = doc.page.margins.left;
  });
}

function renderPdf(tokens: any[], docKind: ExportDocKind): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const isQuotation = docKind === "quotation";
  const doc = new PDFDocument({
    size: "A4",
    margins: isQuotation
      ? { top: 130, bottom: 56, left: 48, right: 48 }
      : { top: 60, bottom: 56, left: 48, right: 48 },
    bufferPages: true,
  });
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // The model's output always starts with an H1 title followed by a
  // "**Label:** value" metadata paragraph — pull those out to render them
  // specially (as a cover page for quotations, as clean stacked lines
  // otherwise) instead of running them through the generic block loop.
  const hasTitle = tokens[0]?.type === "heading" && (tokens[0].depth ?? 1) <= 1;
  const titleText = hasTitle ? plainText(flattenInline(tokens[0].tokens)) : "Document";
  let bodyStart = hasTitle ? 1 : 0;

  let subtitleText: string | null = null;
  if (isQuotation && hasTitle && tokens[bodyStart]?.type === "paragraph") {
    const runs = flattenInline(tokens[bodyStart].tokens);
    if (runs.length > 0 && runs.every((r) => r.italic && !r.bold)) {
      subtitleText = plainText(runs);
      bodyStart += 1;
    }
  }

  const hasMeta = tokens[bodyStart]?.type === "paragraph";
  const metaLines = hasMeta ? splitMetadataLines(flattenInline(tokens[bodyStart].tokens)) : [];
  if (hasMeta) bodyStart += 1;

  if (isQuotation) {
    renderQuotationCover(doc, titleText, subtitleText, metaLines);
    doc.addPage();
  } else {
    doc.font("Helvetica-Bold").fontSize(22).fillColor(COLORS.text);
    doc.text(titleText, { lineGap: 3 });
    if (metaLines.length) {
      doc.moveDown(0.4);
      for (const line of metaLines) {
        renderRuns(doc, line, { baseSize: 11 });
        doc.moveDown(0.08);
      }
    }
    if (metaLines.length || hasTitle) {
      doc.moveDown(0.4);
      drawThinRule(doc);
      doc.moveDown(0.4);
    }
  }

  let firstSection = true;
  for (let idx = bodyStart; idx < tokens.length; idx++) {
    const token = tokens[idx];
    if (token.type === "heading") {
      const depth = token.depth ?? 1;
      const size = depth <= 2 ? 15.5 : 12.5;
      if (depth <= 2 && !firstSection) {
        doc.moveDown(0.5);
        drawThinRule(doc);
      }
      firstSection = false;
      doc.moveDown(depth <= 2 ? 0.55 : 0.55);
      doc.font("Helvetica-Bold").fontSize(size).fillColor(COLORS.text);
      doc.text(plainText(flattenInline(token.tokens)), { lineGap: 3 });
    } else if (token.type === "paragraph") {
      doc.moveDown(0.35);
      renderRuns(doc, flattenInline(token.tokens));
    } else if (token.type === "list") {
      doc.moveDown(0.3);
      renderPdfList(doc, token);
    } else if (token.type === "code") {
      doc.moveDown(0.35);
      const codeText = typeof token.text === "string" ? token.text : "";
      const padding = 10;
      const codeWidth = usableWidth - padding * 2;
      doc.font("Courier").fontSize(9);
      const textHeight = doc.heightOfString(codeText, { width: codeWidth, lineGap: 2 });
      const boxTop = doc.y;
      doc
        .rect(doc.page.margins.left, boxTop, usableWidth, textHeight + padding * 2)
        .fill("#f3f4f6");
      doc
        .fillColor(COLORS.text)
        .text(codeText, doc.page.margins.left + padding, boxTop + padding, {
          width: codeWidth,
          lineGap: 2,
        });
      doc.x = doc.page.margins.left;
      doc.y = boxTop + textHeight + padding * 2;
    } else if (token.type === "blockquote") {
      doc.moveDown(0.35);
      const quoteText = blockToText(token.tokens ?? []);
      const indent = 16;
      doc.font("Helvetica-Oblique").fontSize(11);
      const textHeight = doc.heightOfString(quoteText, { width: usableWidth - indent, lineGap: 2 });
      const barTop = doc.y;
      doc
        .moveTo(doc.page.margins.left, barTop)
        .lineTo(doc.page.margins.left, barTop + textHeight)
        .lineWidth(2)
        .strokeColor(COLORS.muted)
        .stroke();
      doc.fillColor(COLORS.muted).text(quoteText, doc.page.margins.left + indent, barTop, {
        width: usableWidth - indent,
        lineGap: 2,
      });
      doc.x = doc.page.margins.left;
    } else if (token.type === "hr") {
      doc.moveDown(0.5);
      drawThinRule(doc);
      doc.moveDown(0.5);
    } else if (token.type === "table") {
      doc.moveDown(0.3);
      renderPdfTable(doc, token, {
        headerFill: isQuotation ? COLORS.quotationHeaderFill : COLORS.tableHeaderFill,
      });
    }
  }

  if (isQuotation) {
    const { start, count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(start + i);
      drawQuotationHeader(doc);
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

function pushDocxListItems(children: any[], listToken: any, depth = 0): void {
  const items = listToken.items ?? [];
  let index = 1;
  for (const item of items) {
    const { inline, nestedLists } = splitListItem(item);
    if (listToken.ordered) {
      children.push(
        new Paragraph({
          indent: depth > 0 ? { left: 720 * depth } : undefined,
          children: [new TextRun({ text: `${index}. `, bold: true }), ...inlineToTextRuns(inline)],
        }),
      );
      index += 1;
    } else {
      children.push(new Paragraph({ bullet: { level: depth }, children: inlineToTextRuns(inline) }));
    }
    for (const nested of nestedLists) pushDocxListItems(children, nested, depth + 1);
  }
}

const DOCX_CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: "D0D5DD" };
const DOCX_TABLE_BORDERS = {
  top: DOCX_CELL_BORDER,
  bottom: DOCX_CELL_BORDER,
  left: DOCX_CELL_BORDER,
  right: DOCX_CELL_BORDER,
  insideHorizontal: DOCX_CELL_BORDER,
  insideVertical: DOCX_CELL_BORDER,
};

function docxTableCell(text: string, opts: { bold?: boolean; fill?: string } = {}): any {
  return new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold || undefined })] })],
  });
}

function docxTableFromToken(tableToken: any, headerFill: string): Table {
  const header: string[] = (tableToken.header ?? []).map((c: any) => plainText(flattenInline(c?.tokens)));
  const bodyRows: string[][] = (tableToken.rows ?? []).map((row: any[]) =>
    row.map((c) => plainText(flattenInline(c?.tokens))),
  );
  return new Table({
    borders: DOCX_TABLE_BORDERS,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: header.map((h) => docxTableCell(h, { bold: true, fill: headerFill })) }),
      ...bodyRows.map((row) => new TableRow({ children: row.map((cell) => docxTableCell(cell)) })),
    ],
  });
}

const DOCX_RULE_BORDER = {
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0D5DD", space: 4 },
};

async function renderDocx(tokens: any[], docKind: ExportDocKind): Promise<Buffer> {
  const isQuotation = docKind === "quotation";
  const children: any[] = [];

  const hasTitle = tokens[0]?.type === "heading" && (tokens[0].depth ?? 1) <= 1;
  const titleText = hasTitle ? plainText(flattenInline(tokens[0].tokens)) : "Document";
  let bodyStart = hasTitle ? 1 : 0;

  const hasMeta = tokens[bodyStart]?.type === "paragraph";
  const metaLines = hasMeta ? splitMetadataLines(flattenInline(tokens[bodyStart].tokens)) : [];
  if (hasMeta) bodyStart += 1;

  if (hasTitle) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: titleText })] }));
  }
  for (const line of metaLines) {
    children.push(
      new Paragraph({
        children: line.map((r) => new TextRun({ text: r.text, bold: r.bold || undefined })),
      }),
    );
  }
  if (metaLines.length || hasTitle) {
    children.push(new Paragraph({ border: DOCX_RULE_BORDER, children: [] }));
  }

  let firstSection = true;
  for (let idx = bodyStart; idx < tokens.length; idx++) {
    const token = tokens[idx];
    if (token.type === "heading") {
      const depth = Math.min(6, Math.max(1, token.depth ?? 1)) - 1;
      if ((token.depth ?? 1) <= 2 && !firstSection) {
        children.push(new Paragraph({ border: DOCX_RULE_BORDER, children: [] }));
      }
      firstSection = false;
      children.push(
        new Paragraph({
          heading: HEADING_LEVELS[depth],
          children: inlineToTextRuns(token.tokens),
        }),
      );
    } else if (token.type === "paragraph") {
      children.push(new Paragraph({ children: inlineToTextRuns(token.tokens) }));
    } else if (token.type === "list") {
      pushDocxListItems(children, token);
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
      children.push(docxTableFromToken(token, isQuotation ? "DBE4F7" : "F3F4F6"));
      children.push(new Paragraph({ children: [] }));
    } else if (token.type === "hr") {
      children.push(new Paragraph({ border: DOCX_RULE_BORDER, children: [] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
