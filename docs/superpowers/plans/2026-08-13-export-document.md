# Export Document (PDF / MD / DOC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a conversation's final generated document (`conversation.output`) as downloadable PDF (default), Markdown, or Word (.docx) files.

**Architecture:** A server-side conversion module (`apps/server/pipeline/export.ts`) tokenizes markdown with `marked` and renders it to PDF (`pdfkit`) or DOCX (`docx`). Two HTTP endpoints (`apps/server/routes/export.ts`) serve the files: one authenticated (dashboard) and one public (share page). The frontend adds a download control (default PDF + format dropdown) at the top-right of the rendered document in both the dashboard chat and the share page.

**Tech Stack:** TypeScript (Node 22, ESM), `marked`, `pdfkit` + `@types/pdfkit`, `docx`, React 19, Drizzle ORM.

## Global Constraints

- Server is ESM (`"type": "module"`), `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `rootDir: apps/server`, `outDir: dist`.
- Tests use `node:test` + `node:assert/strict`, files named `*.test.ts`, run via `node --test dist/**/*.test.js` after `tsc`.
- Node >= 22 (running v22.23.1).
- `apiUrl(path)` (from `apps/web/src/api/base.ts`) prepends `VITE_API_URL` (empty in production, cross-origin in dev).
- Server PDF is **plain** (headings + text + lists + bold, Helvetica, no brand styling).
- Format query param values: `pdf` (default), `md`, `doc` (`.docx`).
- Session auth via `authenticateRequest(db, req)` → `{ userId: string } | null`.
- `/api/share/*` paths are already exempt from auth middleware (`isPublicShare`).
- `marked` is already a web dependency but NOT yet a server dependency.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add server deps `marked`, `pdfkit`, `docx`, `@types/pdfkit` |
| `apps/server/pipeline/export.ts` | Create | Markdown → PDF/DOCX/MD conversion + helpers |
| `apps/server/pipeline/export.test.ts` | Create | Unit tests for conversion + helpers |
| `apps/server/routes/export.ts` | Create | HTTP endpoints + registration |
| `apps/server/web-server.ts` | Modify | Wire in `registerExportRoutes` |
| `apps/web/src/api/conversations.ts` | Modify | Add `exportUrl` helper |
| `apps/web/src/components/ExportMenu.tsx` | Create | Reusable download control (default PDF + dropdown) |
| `apps/web/src/components/Dashboard.tsx` | Modify | Add download control to output block; remove old "Download Markdown" |
| `apps/web/src/components/SharePage.tsx` | Modify | Add download control to shared document |

---

### Task 1: Add dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `marked`, `pdfkit`, `docx` (runtime deps), `@types/pdfkit` (dev dep) available to `apps/server`.

- [ ] **Step 1: Install dependencies**

```bash
npm install marked@^18.0.9 pdfkit@^0.19.1 docx@^9.7.1
npm install -D @types/pdfkit@^0.17.6
```

- [ ] **Step 2: Verify they resolve**

```bash
npm ls marked pdfkit docx @types/pdfkit
```

Expected: all four listed with versions, no `UNMET DEPENDENCY`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add marked, pdfkit, docx for document export"
```

---

### Task 2: Export module — MD path + helpers

**Files:**
- Create: `apps/server/pipeline/export.ts`
- Test: `apps/server/pipeline/export.test.ts`

**Interfaces:**
- Produces:
  - `type ExportFormat = "pdf" | "md" | "doc"`
  - `interface ExportResult { buffer: Buffer; mimeType: string; extension: string }`
  - `exportDocument(content: string, format: ExportFormat): Promise<ExportResult>` (MD implemented; PDF/DOC throw `"not implemented"` until Task 3/4)
  - `normalizeFormat(format: string | null | undefined): ExportFormat`
  - `sanitizeFilename(title: string, extension: string): string`
  - `parseQueryParam(url: string | undefined, key: string): string | null`
  - `flattenInline(tokens: any[] | undefined, runs?: InlineRun[]): InlineRun[]`
  - `plainText(runs: InlineRun[]): string`

- [ ] **Step 1: Write the failing test**

Create `apps/server/pipeline/export.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  exportDocument,
  normalizeFormat,
  sanitizeFilename,
  parseQueryParam,
  flattenInline,
  plainText,
} from "./export.js";

describe("normalizeFormat", () => {
  it("defaults to pdf for missing/invalid values", () => {
    assert.equal(normalizeFormat(undefined), "pdf");
    assert.equal(normalizeFormat(null), "pdf");
    assert.equal(normalizeFormat(""), "pdf");
    assert.equal(normalizeFormat("PDF"), "pdf");
    assert.equal(normalizeFormat("docx"), "pdf");
  });

  it("recognizes md and doc", () => {
    assert.equal(normalizeFormat("md"), "md");
    assert.equal(normalizeFormat("doc"), "doc");
    assert.equal(normalizeFormat("pdf"), "pdf");
  });
});

describe("sanitizeFilename", () => {
  it("strips unsafe characters and collapses spaces to dashes", () => {
    assert.equal(sanitizeFilename("My PRD: Test!", "pdf"), "My-PRD-Test.pdf");
    assert.equal(sanitizeFilename("  Quotation / Estimate  ", "docx"), "Quotation-Estimate.docx");
  });

  it("falls back to sandwich for empty titles", () => {
    assert.equal(sanitizeFilename("   ", "md"), "sandwich.md");
    assert.equal(sanitizeFilename("", "pdf"), "sandwich.pdf");
  });
});

describe("parseQueryParam", () => {
  it("extracts a query parameter", () => {
    assert.equal(parseQueryParam("/api/foo?format=md&x=1", "format"), "md");
    assert.equal(parseQueryParam("/api/foo?format=pdf", "format"), "pdf");
  });

  it("returns null when absent", () => {
    assert.equal(parseQueryParam("/api/foo", "format"), null);
    assert.equal(parseQueryParam("/api/foo?other=1", "format"), null);
    assert.equal(parseQueryParam(undefined, "format"), null);
  });
});

describe("flattenInline / plainText", () => {
  it("flattens bold, italic, and code runs", () => {
    const tokens = [
      { type: "text", text: "Hello " },
      { type: "strong", tokens: [{ type: "text", text: "bold" }] },
      { type: "text", text: " and " },
      { type: "em", tokens: [{ type: "text", text: "italic" }] },
      { type: "text", text: " plus " },
      { type: "codespan", text: "code" },
    ];
    const runs = flattenInline(tokens);
    assert.equal(plainText(runs), "Hello bold and italic plus code");
    assert.deepEqual(
      runs.map((r) => ({ text: r.text, bold: r.bold, italic: r.italic })),
      [
        { text: "Hello ", bold: false, italic: false },
        { text: "bold", bold: true, italic: false },
        { text: " and ", bold: false, italic: false },
        { text: "italic", bold: false, italic: true },
        { text: " plus ", bold: false, italic: false },
        { text: "code", bold: false, italic: false },
      ],
    );
  });

  it("handles nested emphasis", () => {
    const tokens = [
      { type: "strong", tokens: [{ type: "em", tokens: [{ type: "text", text: "both" }] }] },
    ];
    const runs = flattenInline(tokens);
    assert.equal(runs[0]!.bold, true);
    assert.equal(runs[0]!.italic, true);
    assert.equal(runs[0]!.text, "both");
  });
});

describe("exportDocument (md)", () => {
  it("returns the original markdown unchanged", async () => {
    const md = "# Title\n\nHello **world**.\n";
    const result = await exportDocument(md, "md");
    assert.equal(result.extension, "md");
    assert.match(result.mimeType, /markdown/);
    assert.equal(result.buffer.toString("utf-8"), md);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: FAIL — `Cannot find module './export.js'`.

- [ ] **Step 3: Write the module skeleton (MD + helpers)**

Create `apps/server/pipeline/export.ts`:

```typescript
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
    throw new Error("not implemented");
  }

  throw new Error("not implemented");
}

> Note: `PDFDocument`, `Document`, `Packer`, `Paragraph`, `TextRun`, `HeadingLevel` are imported above but not yet used — that is fine (this project does not enable `noUnusedLocals`); they become used in Tasks 3 and 4.
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/pipeline/export.ts apps/server/pipeline/export.test.ts
git commit -m "feat: document export module (markdown + helpers)"
```

---

### Task 3: PDF renderer

**Files:**
- Modify: `apps/server/pipeline/export.ts`
- Test: `apps/server/pipeline/export.test.ts`

**Interfaces:**
- Produces: `exportDocument(content, "pdf")` returns a non-empty PDF buffer.

- [ ] **Step 1: Write the failing test**

Append to `apps/server/pipeline/export.test.ts` (inside the existing `describe` blocks, add a new describe):

```typescript
describe("exportDocument (pdf)", () => {
  const markdown = [
    "# Title",
    "",
    "Paragraph with **bold**, *italic*, and `code`.",
    "",
    "- item one",
    "- item two",
    "",
    "1. first",
    "2. second",
    "",
    "| Col A | Col B |",
    "|-------|-------|",
    "| 1     | 2     |",
    "",
    "> a quoted note",
  ].join("\n");

  it("returns a PDF buffer with the PDF magic bytes", async () => {
    const result = await exportDocument(markdown, "pdf");
    assert.equal(result.extension, "pdf");
    assert.equal(result.mimeType, "application/pdf");
    assert.ok(result.buffer.length > 500, `expected substantial PDF, got ${result.buffer.length} bytes`);
    assert.equal(result.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  });

  it("does not throw on empty content", async () => {
    const result = await exportDocument("", "pdf");
    assert.equal(result.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: FAIL — `Error: not implemented` on the `pdf` case.

- [ ] **Step 3: Implement the PDF renderer**

In `apps/server/pipeline/export.ts`, replace the `if (format === "pdf") { throw ... }` branch and add the renderer functions.

Replace:

```typescript
  const tokens = marked.lexer(content) as unknown as any[];

  if (format === "pdf") {
    throw new Error("not implemented");
  }

  throw new Error("not implemented");
```

With:

```typescript
  const tokens = marked.lexer(content) as unknown as any[];

  if (format === "pdf") {
    return { buffer: await renderPdf(tokens), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  throw new Error("not implemented");
```

And add these functions below `exportDocument` (replacing the `void PDFDocument; ...` block):

```typescript
function addPdfRuns(
  doc: PDFKit.PDFDocument,
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: PASS (all tests including the new PDF ones).

- [ ] **Step 5: Commit**

```bash
git add apps/server/pipeline/export.ts apps/server/pipeline/export.test.ts
git commit -m "feat: PDF renderer for document export"
```

---

### Task 4: DOCX renderer

**Files:**
- Modify: `apps/server/pipeline/export.ts`
- Test: `apps/server/pipeline/export.test.ts`

**Interfaces:**
- Produces: `exportDocument(content, "doc")` returns a non-empty `.docx` (zip) buffer.

- [ ] **Step 1: Write the failing test**

Append to `apps/server/pipeline/export.test.ts`:

```typescript
describe("exportDocument (doc)", () => {
  const markdown = "# Title\n\nParagraph with **bold**.\n\n- item one\n\n1. first\n";

  it("returns a DOCX buffer with the zip magic bytes", async () => {
    const result = await exportDocument(markdown, "doc");
    assert.equal(result.extension, "docx");
    assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.ok(result.buffer.length > 500, `expected substantial DOCX, got ${result.buffer.length} bytes`);
    // "PK" zip magic bytes
    assert.equal(result.buffer.subarray(0, 2).toString("ascii"), "PK");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: FAIL — `Error: not implemented` on the `doc` case.

- [ ] **Step 3: Implement the DOCX renderer**

In `apps/server/pipeline/export.ts`, replace the final `throw new Error("not implemented");` in `exportDocument`:

```typescript
  if (format === "pdf") {
    return { buffer: await renderPdf(tokens), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  throw new Error("not implemented");
```

With:

```typescript
  if (format === "pdf") {
    return { buffer: await renderPdf(tokens), mimeType: MIME.pdf, extension: EXT.pdf };
  }

  return { buffer: await renderDocx(tokens), mimeType: MIME.doc, extension: EXT.doc };
```

Then add these functions after `renderPdf`:

```typescript
const HEADING_LEVELS: HeadingLevel[] = [
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
```

> The functions above use `Table`, `TableRow`, and `TableCell` directly — update the `docx` import at the top of `apps/server/pipeline/export.ts` accordingly:

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from "docx";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/pipeline/export.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/pipeline/export.ts apps/server/pipeline/export.test.ts
git commit -m "feat: DOCX renderer for document export"
```

---

### Task 5: Export routes + wiring

**Files:**
- Create: `apps/server/routes/export.ts`
- Modify: `apps/server/web-server.ts`

**Interfaces:**
- Consumes: `exportDocument`, `normalizeFormat`, `sanitizeFilename`, `parseQueryParam`, `ExportResult` from `../pipeline/export.js`; `getConversation` from `../db/conversations.js`; `conversations as conversationsTable` from `../db/schema.js`; `authenticateRequest`; `sendJson`, `sendCaughtError`.
- Produces: `registerExportRoutes(router: Router, db: Database): void`

- [ ] **Step 1: Write the routes module**

Create `apps/server/routes/export.ts`:

```typescript
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
```

- [ ] **Step 2: Wire into the web server**

In `apps/server/web-server.ts`, add the import (next to the other route imports):

```typescript
import { registerExportRoutes } from "./routes/export.js";
```

And register the routes (after `registerConversationRunRoutes`):

```typescript
  registerConversationRunRoutes(router, db);
  registerExportRoutes(router, db);
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/routes/export.ts apps/server/web-server.ts
git commit -m "feat: export API endpoints + wire into web server"
```

---

### Task 6: Frontend — download control

**Files:**
- Create: `apps/web/src/components/ExportMenu.tsx`
- Modify: `apps/web/src/api/conversations.ts`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/SharePage.tsx`

**Interfaces:**
- Consumes: `apiUrl` from `../api/base`.
- Produces: `ExportMenu` component; `exportUrl(conversationId, format)` helper.

- [ ] **Step 1: Add the `exportUrl` helper**

In `apps/web/src/api/conversations.ts`, append:

```typescript
export type ExportFormat = 'pdf' | 'md' | 'doc'

export function exportUrl(conversationId: string, format: ExportFormat): string {
  return apiUrl(`/api/conversations/${encodeURIComponent(conversationId)}/export?format=${format}`)
}
```

- [ ] **Step 2: Create the ExportMenu component**

Create `apps/web/src/components/ExportMenu.tsx`:

```tsx
import { useState } from 'react'

export type ExportFormat = 'pdf' | 'md' | 'doc'

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'doc', label: 'Word (.docx)' },
]

export function ExportMenu({
  url,
  onDownloaded,
}: {
  url: (format: ExportFormat) => string
  onDownloaded?: (format: ExportFormat) => void
}) {
  const [open, setOpen] = useState(false)

  const download = (format: ExportFormat) => {
    setOpen(false)
    const a = document.createElement('a')
    a.href = url(format)
    a.rel = 'noopener'
    a.click()
    onDownloaded?.(format)
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => download('pdf')}
        className="flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#111827' }}
        title="Download PDF"
      >
        <iconify-icon icon="solar:download-minimalistic-linear" width="13" style={{ color: '#ffffff' }} />
        Download
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-r-lg px-1.5 py-1.5 text-xs transition-colors"
        style={{ backgroundColor: '#111827', color: 'rgba(255,255,255,0.7)', borderLeft: '1px solid rgba(255,255,255,0.15)' }}
        title="Choose format"
      >
        <iconify-icon icon="solar:alt-arrow-down-linear" width="12" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl overflow-hidden"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)',
            }}
          >
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => download(f.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the download control to the Dashboard output block**

In `apps/web/src/components/Dashboard.tsx`:

Add the import near the top (with the other imports):

```typescript
import { ExportMenu } from './ExportMenu'
import { exportUrl } from '../api/conversations'
```

Locate the AI output block in `ChatView` (the `m.isDone && m.output` branch). Change:

```tsx
                {msgs.map((m, i) => {
                  if (m.isDone && m.output) return (
                    <div key={i} className="group">
                      <div className="text-sm break-words sandwich-output" style={{ color: 'rgba(0,0,0,0.8)', lineHeight: '1.85' }}
                        dangerouslySetInnerHTML={{ __html: marked.parse(m.output) as string }} />
```

To:

```tsx
                {msgs.map((m, i) => {
                  if (m.isDone && m.output) return (
                    <div key={i} className="group relative">
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <ExportMenu
                          url={(f) => exportUrl(conversationId, f)}
                          onDownloaded={(f) => { if (f === 'md') localStorage.setItem(EXPORTED_MD_KEY, '1') }}
                        />
                      </div>
                      <div className="text-sm break-words sandwich-output" style={{ color: 'rgba(0,0,0,0.8)', lineHeight: '1.85' }}
                        dangerouslySetInnerHTML={{ __html: marked.parse(m.output) as string }} />
```

- [ ] **Step 4: Remove the old "Download Markdown" menu item**

In `apps/web/src/components/Dashboard.tsx`, remove the `handleExportMarkdown` function:

```typescript
  const handleExportMarkdown = () => {
    if (!currentConversation) return
    setShowMoreMenu(false)
    const md = currentConversation.content ?? currentConversation.description
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentConversation.summary.slice(0, 60).replace(/[^\w\- ]/g, '').trim() || 'sandwich'}.md`
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem(EXPORTED_MD_KEY, '1')
  }
```

And remove the "Download Markdown" button from the `...` menu:

```tsx
                        <button onClick={handleExportMarkdown}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <iconify-icon icon="solar:download-minimalistic-linear" width="15" />
                          Download Markdown
                        </button>
```

- [ ] **Step 5: Add the download control to the SharePage**

In `apps/web/src/components/SharePage.tsx`:

Add the import:

```typescript
import { ExportMenu } from './ExportMenu'
```

Replace the header block:

```tsx
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#f91814' }}>
            Spectr · shared brief
          </p>
          <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>{conversation.title}</h1>
        </div>
```

With:

```tsx
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#f91814' }}>
              Spectr · shared brief
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>{conversation.title}</h1>
          </div>
          <ExportMenu url={(f) => apiUrl(`/api/share/${encodeURIComponent(token ?? '')}/export?format=${f}`)} />
        </div>
```

- [ ] **Step 6: Typecheck both packages**

```bash
npx tsc -p tsconfig.json --noEmit
npm --prefix apps/web run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ExportMenu.tsx apps/web/src/api/conversations.ts apps/web/src/components/Dashboard.tsx apps/web/src/components/SharePage.tsx
git commit -m "feat: download control (PDF/MD/DOC) on output + share page"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Run the full test suite + typecheck**

```bash
npm test
```

Expected: `tsc` compiles clean, all `node:test` suites pass (including `export.test.js`).

- [ ] **Step 2: Manual verification of the conversion**

```bash
node -e "import('./dist/pipeline/export.js').then(async (m) => { const r = await m.exportDocument('# Hello\n\n**bold** text', 'pdf'); console.log(r.extension, r.buffer.length, r.buffer.subarray(0,4).toString()); const d = await m.exportDocument('# Hello', 'doc'); console.log(d.extension, d.buffer.length, d.buffer.subarray(0,2).toString()); })"
```

Expected: prints `pdf <length> %PDF` and `docx <length> PK`.

- [ ] **Step 3: Manual endpoint check (requires running Postgres + server + a session cookie)**

```bash
curl -i "http://localhost:4319/api/conversations/<conversationId>/export?format=pdf" \
  -H "cookie: session=<your-session-token>" \
  -o /tmp/export.pdf
file /tmp/export.pdf
```

Expected: `200` + `content-disposition: attachment; filename="..."` and `/tmp/export.pdf` is a PDF document.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: e2e verification fixes"
```
