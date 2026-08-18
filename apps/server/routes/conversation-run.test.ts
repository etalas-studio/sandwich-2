import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { composePrototypeBrief, prototypePreviewUrl } from "./conversation-run.js";

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
