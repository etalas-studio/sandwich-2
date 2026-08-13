# Export Document (PDF / MD / DOC) Design

## Overview

Add the ability to export the final generated document of a conversation (PRD, quotation, MOM, specs, workflow) to downloadable files in three formats: **PDF (default), Markdown, and Word (.docx)**.

Today the AI output lives only as text rendered inside the chat room. This feature turns `conversation.output` (the final markdown document) into a real downloadable file, reachable both from the dashboard chat view and the public share page.

## Scope

- Export **final document output only** (`conversation.output`), not the full chat transcript.
- Formats: `pdf` (default), `md`, `doc` (`.docx`).
- PDF is **plain**: headings + text + lists + bold, standard font, no brand styling.
- Download button placed at the **top-right of the rendered document block** in the chat view, with a format picker.
- Same download button available on the **public share page** (`/share/:token`).

## Folder Placement

Follows the existing convention (`pipeline/` = pure logic, `routes/` = HTTP handlers):

- `apps/server/pipeline/export.ts` — markdown → PDF / DOCX / MD conversion logic.
- `apps/server/routes/export.ts` — HTTP route handlers + registration.

These live alongside the existing PRD/quotation generation pipeline (`routes/conversation-run.ts`) and pipeline modules.

## Backend

### New dependencies (root `package.json`)

| Package | Purpose |
|---------|---------|
| `marked` | Markdown tokenizer (single parsing source for PDF + DOCX) |
| `pdfkit` + `@types/pdfkit` | PDF generation |
| `docx` | `.docx` generation |

All are pure JS (no native compilation), safe on Railway.

### Conversion module: `apps/server/pipeline/export.ts`

```ts
export type ExportFormat = "pdf" | "md" | "doc";

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export async function exportDocument(
  content: string,
  format: ExportFormat,
): Promise<ExportResult>
```

Implementation:
1. Tokenize markdown with `marked.lexer(content)`.
2. **PDF** — render tokens with `pdfkit` (Helvetica): h1/h2/h3 at 20/16/14, body 11, bullet lists "•", ordered lists "1.", bold via `Helvetica-Bold`, markdown tables as a simple grid.
3. **DOC** — render tokens with `docx` (`Document`, `Paragraph`, `TextRun`, `HeadingLevel`, `BulletLevel`).
4. **MD** — `Buffer.from(content, "utf-8")`, mime `text/markdown`.

### Routes: `apps/server/routes/export.ts`

```ts
export function registerExportRoutes(router: Router, db: Database): void
```

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/conversations/:id/export?format=pdf\|md\|doc` | Yes | Export own conversation output |
| `GET` | `/api/share/:token/export?format=pdf\|md\|doc` | No | Export a shared document |

Behavior:
- Load the conversation (by id + ownership, or by `shareToken`).
- Read `conversation.output`; if empty → `400 { error: "no output to export" }`.
- Missing conversation / share token → `404`.
- Invalid or missing `format` → default `pdf`.
- Respond with `Content-Type` + `Content-Disposition: attachment; filename="<sanitized title>.<ext>"` and the buffer.

Wiring: in `web-server.ts`, `import { registerExportRoutes } from "./routes/export.js"` and call `registerExportRoutes(router, db)`.

Note: the `/api/share/*` prefix is already exempt from auth middleware (`isPublicShare`), so the public export endpoint requires no middleware change.

## Frontend

### Dashboard (`apps/web/src/components/Dashboard.tsx`)

- On the rendered AI output block (`m.output`), add a download control at the **top-right**: a "Download" button (default PDF) with a small dropdown for **PDF / Markdown / Word**.
- Remove the old "Download Markdown" item from the `...` menu (superseded by this control).
- Download mechanism: navigate to the authenticated export URL; the server's `Content-Disposition: attachment` triggers the browser download.

### SharePage (`apps/web/src/components/SharePage.tsx`)

- Add the same download control at the top-right of the document, using the public endpoint `/api/share/:token/export?format=...`.

## Error Handling

| Case | Response |
|------|----------|
| Empty output | `400` |
| Conversation/share not found | `404` |
| Foreign conversation access | `401` (middleware) |
| Unknown format | default `pdf` |

## Testing

- Unit tests for `exportDocument`:
  - PDF buffer is non-empty and starts with the PDF magic bytes (`%PDF`).
  - DOCX buffer is non-empty (zip magic bytes `PK`).
  - MD returns the original content unchanged.
  - Rendering covers headings, paragraphs, lists, bold, and a markdown table.
- Route behavior covered by existing server test conventions where practical.

## Out of Scope

- Styled/branded PDF output (plain only, per requirement).
- Exporting the full chat transcript.
- Exporting the standalone prototype pipeline output (separate feature).
- Custom filename input from the user.
