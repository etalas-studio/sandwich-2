import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildReferenceContext,
  buildPrototypeSystemPrompt,
  buildPrototypeRefinePrompt,
  PROTOTYPE_FILE,
} from "./prompts.js";

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

  it("mandates a single self-contained file and forbids extra files", () => {
    const prompt = buildPrototypeSystemPrompt("bikinin dashboard admin");
    assert.ok(prompt.includes(PROTOTYPE_FILE));
    assert.ok(prompt.includes("ONE FILE ONLY"));
    assert.ok(prompt.includes("Do NOT create any other file"));
    assert.ok(/no .*styles\.css/i.test(prompt));
  });

  it("keeps the craft rules: no emoji, Lucide, quality tables, custom modals", () => {
    const prompt = buildPrototypeSystemPrompt("bikinin dashboard admin");
    assert.ok(prompt.includes("lucide.createIcons()"));
    assert.ok(prompt.includes("NEVER use emoji"));
    assert.ok(prompt.includes("<table>"));
    assert.ok(prompt.includes("NEVER `window.confirm()`"));
  });
});

describe("buildPrototypeRefinePrompt", () => {
  it("names the one file, embeds the instruction, and demands in-place edits", () => {
    const prompt = buildPrototypeRefinePrompt("POS kasir", "pindahkan marquee ke bawah hero");
    assert.ok(prompt.includes(PROTOTYPE_FILE));
    assert.ok(prompt.includes("pindahkan marquee ke bawah hero"));
    assert.ok(prompt.includes("Do NOT regenerate"));
    assert.ok(prompt.includes("Hard boundaries"));
    assert.ok(prompt.includes("DONE"));
  });

  it("does NOT leak the full original brief into the refine prompt", () => {
    const prompt = buildPrototypeRefinePrompt("POS kasir dengan manajemen menu", "ubah warnanya jadi biru");
    assert.ok(!prompt.includes("POS kasir dengan manajemen menu"));
    assert.ok(prompt.includes("ubah warnanya jadi biru"));
  });

  it("falls back to a generic instruction when empty", () => {
    const prompt = buildPrototypeRefinePrompt("POS kasir", "");
    assert.ok(prompt.includes("Apply the user's requested change."));
  });
});
