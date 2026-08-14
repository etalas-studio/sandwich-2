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
  it("includes reference context when styles are provided", () => {
    const prompt = buildPrototypeSystemPrompt("bikinin landing page", [
      {
        url: "https://example.com",
        html: "<h1>hi</h1>",
        tokens: { colors: ["#111"], fonts: [], spacings: [], radii: [], shadows: [] },
      },
    ]);
    assert.ok(prompt.includes("## Reference Style"));
    assert.ok(prompt.includes("https://example.com"));
  });

  it("omits reference section when no styles", () => {
    const prompt = buildPrototypeSystemPrompt("bikinin landing page");
    assert.ok(!prompt.includes("## Reference Style"));
  });
});
