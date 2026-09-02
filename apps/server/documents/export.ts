import { marked } from "marked";
import puppeteer from "puppeteer";
// @ts-ignore — html-to-docx has no bundled types
import HTMLtoDOCX from "html-to-docx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type ExportFormat = "pdf" | "md" | "doc";
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

const LOGO_PATH = fileURLToPath(new URL("./assets/etalas-logo.png", import.meta.url));
const LOGO_B64 = (() => {
  try {
    return readFileSync(LOGO_PATH).toString("base64");
  } catch {
    return "";
  }
})();

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
  return `${base || "spectr"}.${extension}`;
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

// Kept for backward-compat — export.test.ts imports these directly.
export function flattenInline(tokens: any[] | undefined, runs: InlineRun[] = []): InlineRun[] {
  if (!tokens) return runs;
  for (const t of tokens) {
    if (t.type === "text" && Array.isArray(t.tokens)) {
      flattenInline(t.tokens, runs);
    } else if (t.type === "text" || t.type === "codespan") {
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
        runs.push({ text: r.text, bold: r.bold || t.type === "strong", italic: r.italic || t.type === "em", code: r.code });
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

function buildHtml(content: string, docKind: ExportDocKind): string {
  const isQuotation = docKind === "quotation";
  const body = marked.parse(content) as string;

  const quotationHeader = isQuotation && LOGO_B64
    ? `<div class="letterhead">
        <div class="ribbon"></div>
        <div class="letterhead-inner">
          <img src="data:image/png;base64,${LOGO_B64}" class="logo" alt="Etalas" />
          <div class="address">
            <strong>Office</strong><br/>
            Artha Graha, Lt.2 Unit 2601 SCBD, Jl. Jend. Sudirman 52-53<br/>
            Jakarta (etalas.com)
          </div>
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: #1f2328;
    line-height: 1.55;
    padding: ${isQuotation ? "0" : "32px 48px"};
  }
  .letterhead {
    margin-bottom: 32px;
  }
  .ribbon {
    height: 7px;
    background: linear-gradient(to right, #eaf2ff, #5b93f5, #1d4ed8);
  }
  .letterhead-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 48px 0;
  }
  .logo { width: 90px; }
  .address {
    font-size: 8pt;
    color: #6b7280;
    text-align: right;
    line-height: 1.6;
  }
  h1 { font-size: 22pt; margin: 24px 0 8px; ${isQuotation ? "padding: 0 48px;" : ""} }
  h2 { font-size: 15.5pt; margin: 20px 0 6px; border-bottom: 1px solid #d0d5dd; padding-bottom: 4px; ${isQuotation ? "padding: 0 48px 4px;" : ""} }
  h3, h4, h5, h6 { font-size: 12.5pt; margin: 16px 0 4px; ${isQuotation ? "padding: 0 48px;" : ""} }
  p { margin: 8px 0; ${isQuotation ? "padding: 0 48px;" : ""} }
  ul, ol { margin: 8px 0 8px ${isQuotation ? "64px" : "16px"}; padding-left: 20px; }
  li { margin: 3px 0; }
  code { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 4px; margin: 10px ${isQuotation ? "48px" : "0"}; overflow-wrap: break-word; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #6b7280; padding-left: 14px; color: #6b7280; font-style: italic; margin: 10px ${isQuotation ? "48px" : "0"}; }
  hr { border: none; border-top: 1px solid #d0d5dd; margin: 16px ${isQuotation ? "48px" : "0"}; }
  table { border-collapse: collapse; width: ${isQuotation ? "calc(100% - 96px)" : "100%"}; margin: 10px ${isQuotation ? "48px" : "0"}; font-size: 9.5pt; }
  th { background: ${isQuotation ? "#dbe4f7" : "#f3f4f6"}; font-weight: bold; }
  th, td { border: 1px solid #d0d5dd; padding: 6px 8px; text-align: left; }
  strong { font-weight: bold; }
  em { font-style: italic; }
</style>
</head>
<body>
${quotationHeader}
${body}
</body>
</html>`;
}

let _browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!_browser) {
    _browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
  return _browser;
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "16mm", left: "0", right: "0" } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

async function renderDocx(html: string): Promise<Buffer> {
  const buf = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });
  return Buffer.from(buf);
}

export async function exportDocument(
  content: string,
  format: ExportFormat,
  docKind: ExportDocKind = "other",
): Promise<ExportResult> {
  if (format === "md") {
    return { buffer: Buffer.from(content, "utf-8"), mimeType: MIME.md, extension: EXT.md };
  }

  const html = buildHtml(content, docKind);

  if (format === "pdf") {
    return { buffer: await renderPdf(html), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  return { buffer: await renderDocx(html), mimeType: MIME.doc, extension: EXT.doc };
}
