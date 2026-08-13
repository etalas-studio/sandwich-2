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
