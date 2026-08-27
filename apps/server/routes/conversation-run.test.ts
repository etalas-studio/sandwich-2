import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { composePrototypeBrief, composeRefineInstruction, prototypePreviewUrl } from "./conversation-run.js";

describe("composePrototypeBrief", () => {
  it("folds all user turns and skips assistant turns", () => {
    const brief = composePrototypeBrief([
      { role: "user", content: "Buatkan prototype aplikasi POS" },
      { role: "assistant", content: "Siapa target usernya?" },
      { role: "user", content: "Kasir dan admin gudang" },
    ]);
    assert.equal(
      brief,
      "Buatkan prototype aplikasi POS\n\nKasir dan admin gudang",
    );
  });

  it("dedupes consecutive duplicates and drops empty turns", () => {
    const brief = composePrototypeBrief([
      { role: "user", content: "brief" },
      { role: "user", content: "brief" },
      { role: "user", content: "   " },
    ]);
    assert.equal(brief, "brief");
  });
});

describe("composeRefineInstruction", () => {
  const generated = { role: "assistant", content: "Prototype generated — v1\n\nPreview: [Buka prototype](...)" } as const;

  it("returns only feedback that arrived AFTER the last generation", () => {
    const instruction = composeRefineInstruction([
      { role: "user", content: "Buatkan prototype POS" },
      { role: "assistant", content: "Siapa target usernya?" },
      { role: "user", content: "Kasir dan admin" },
      generated,
      { role: "user", content: "marquee nya salah posisi" },
      { role: "assistant", content: "Oke, noted. Ada revisi lain?" },
      { role: "user", content: "itu dulu aja" },
    ]);
    assert.equal(instruction, "marquee nya salah posisi\n\nitu dulu aja");
  });

  it("excludes the original brief when there was no prior document", () => {
    const instruction = composeRefineInstruction([
      { role: "user", content: "Buatkan prototype POS" },
      { role: "assistant", content: "Siapa target usernya?" },
    ]);
    assert.equal(instruction, "");
  });

  it("dedupes consecutive duplicates", () => {
    const instruction = composeRefineInstruction([
      generated,
      { role: "user", content: "geser marquee ke bawah" },
      { role: "user", content: "geser marquee ke bawah" },
    ]);
    assert.equal(instruction, "geser marquee ke bawah");
  });
});

describe("prototypePreviewUrl", () => {
  it("uses PREVIEW_DOMAIN when set", () => {
    const prev = process.env.PREVIEW_DOMAIN;
    process.env.PREVIEW_DOMAIN = "preview.example.com/";
    assert.equal(
      prototypePreviewUrl("doc1"),
      "https://preview.example.com/p/doc1/",
    );
    if (prev !== undefined) process.env.PREVIEW_DOMAIN = prev;
    else delete process.env.PREVIEW_DOMAIN;
  });

  it("falls back to a relative /p/ path", () => {
    const prev = process.env.PREVIEW_DOMAIN;
    delete process.env.PREVIEW_DOMAIN;
    assert.equal(prototypePreviewUrl("doc1"), "/p/doc1/");
    if (prev !== undefined) process.env.PREVIEW_DOMAIN = prev;
  });
});
