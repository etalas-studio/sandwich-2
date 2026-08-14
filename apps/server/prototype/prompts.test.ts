import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildReferenceContext, buildPrototypeSystemPrompt } from "./prompts.js";

describe("buildReferenceContext", () => {
  it("returns an empty string when there are no references", () => {
    assert.equal(buildReferenceContext([]), "");
  });

  it("summarizes tokens + visual description and omits raw HTML", () => {
    const ctx = buildReferenceContext([
      {
        url: "https://example.com",
        html: "<html><script>alert('inject')</script></html>",
        tokens: {
          colors: ["#111827", "#f91814"],
          fonts: ["Inter"],
          spacings: ["20px"],
          radii: ["12px"],
          shadows: [],
        },
        visualDescription: "Clean minimal layout with red accents.",
      },
    ]);
    assert.ok(ctx.includes("https://example.com"));
    assert.ok(ctx.includes("#111827"));
    assert.ok(ctx.includes("Inter"));
    assert.ok(ctx.includes("Clean minimal layout with red accents."));
    // Raw HTML must never be injected into the prompt.
    assert.ok(!ctx.includes("<script>"));
    assert.ok(!ctx.includes("alert('inject')"));
  });
});

describe("buildPrototypeSystemPrompt", () => {
  it("includes reference context when provided", () => {
    const prompt = buildPrototypeSystemPrompt({
      brief: "bikinin landing page",
      palette: null,
      logoData: null,
      referenceContext: "## Reference Style\n- Colors: #111",
    });
    assert.ok(prompt.includes("## Reference Style"));
    assert.ok(prompt.includes("- Colors: #111"));
  });

  it("omits reference section when no reference context", () => {
    const prompt = buildPrototypeSystemPrompt({
      brief: "bikinin landing page",
      palette: null,
      logoData: null,
    });
    assert.ok(!prompt.includes("## Reference Style"));
  });
});
