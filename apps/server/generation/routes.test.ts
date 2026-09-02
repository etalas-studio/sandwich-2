import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { prototypePreviewUrl } from "../infrastructure/http/generation.js";
import {
  composePrototypeBrief,
  composeRefineInstruction,
  deliverablePathFor,
  textEngineTools,
  commitMessageFor,
  chatOutputFor,
  CHAT_INLINE_CAP,
} from "./run.js";

describe("deliverablePathFor", () => {
  it("maps each type to its fixed on-disk filename", () => {
    assert.equal(deliverablePathFor("prd"), "prd.md");
    assert.equal(deliverablePathFor("quotation"), "quotation.md");
    assert.equal(deliverablePathFor("specs"), "spec.md");
    assert.equal(deliverablePathFor("mom"), "mom.md");
    assert.equal(deliverablePathFor("prototype"), "prototype/index.html");
  });
});

describe("textEngineTools", () => {
  it("is read-only for chat stages, writable while generating", () => {
    assert.deepEqual([...textEngineTools("clarifying")].sort(), ["find", "grep", "ls", "read"]);
    assert.ok([...textEngineTools("generating")].includes("write"));
  });

  it("honours the TEXT_ENGINE_TOOLS=off kill switch", () => {
    const prev = process.env.TEXT_ENGINE_TOOLS;
    process.env.TEXT_ENGINE_TOOLS = "off";
    try {
      assert.deepEqual(textEngineTools("generating"), []);
    } finally {
      if (prev === undefined) delete process.env.TEXT_ENGINE_TOOLS;
      else process.env.TEXT_ENGINE_TOOLS = prev;
    }
  });
});

describe("commitMessageFor", () => {
  it("has a typed subject and trailer body for git-log parsing", () => {
    const m = commitMessageFor("prd", "generate", "conv-123", "generating", "Build a POS  \n for a cafe");
    assert.equal(m.subject, "prd: generate");
    assert.match(m.body, /Prompt: Build a POS for a cafe/);
    assert.match(m.body, /Spectr-Deliverable: prd/);
    assert.match(m.body, /Spectr-Conversation: conv-123/);
    assert.match(m.body, /Spectr-Stage: generating/);
  });
});

describe("chatOutputFor", () => {
  it("inlines a short text deliverable verbatim", () => {
    assert.equal(chatOutputFor("prd", "# Short PRD", null), "# Short PRD");
  });

  it("summarises an over-cap deliverable instead of dumping it", () => {
    const big = "x".repeat(CHAT_INLINE_CAP + 1);
    const out = chatOutputFor("prd", big, null);
    assert.ok(!out.includes(big));
    assert.match(out, /panel dokumen/);
  });

  it("gives the prototype a preview link, not its HTML", () => {
    const out = chatOutputFor("prototype", "<html>...</html>", "/p/abc/");
    assert.doesNotMatch(out, /<html>/);
    assert.match(out, /\/p\/abc\//);
  });
});

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
