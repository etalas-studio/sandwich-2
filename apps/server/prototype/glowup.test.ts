import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildGlowupSystemPrompt, glowupModelId } from "./glowup.js";

describe("glowupModelId", () => {
  it("defaults to deepseek-v4-flash", () => {
    const prev = process.env.GLOWUP_MODEL;
    delete process.env.GLOWUP_MODEL;
    assert.equal(glowupModelId(), "deepseek-v4-flash");
    if (prev !== undefined) process.env.GLOWUP_MODEL = prev;
  });

  it("honors GLOWUP_MODEL override", () => {
    const prev = process.env.GLOWUP_MODEL;
    process.env.GLOWUP_MODEL = "deepseek-v4-pro";
    assert.equal(glowupModelId(), "deepseek-v4-pro");
    if (prev !== undefined) process.env.GLOWUP_MODEL = prev;
    else delete process.env.GLOWUP_MODEL;
  });
});

describe("buildGlowupSystemPrompt", () => {
  const prompt = buildGlowupSystemPrompt({ brief: "A SaaS for warehouse inventory" });

  it("embeds the client brief", () => {
    assert.ok(prompt.includes("A SaaS for warehouse inventory"));
  });

  it("points the agent at the vendored taste library", () => {
    assert.ok(prompt.includes(".getokui/index.json"));
    assert.ok(prompt.includes(".getokui/dna/"));
  });

  it("mandates style-not-content and stack preservation", () => {
    assert.ok(prompt.includes("STYLE, NOT CONTENT"));
    assert.ok(prompt.includes("plain static HTML"));
    assert.ok(prompt.includes("styles.css"));
    assert.ok(prompt.includes("script.js"));
  });

  it("encodes the hard floors", () => {
    assert.ok(prompt.includes("4.5:1"));
    assert.ok(prompt.includes("padding-block: 5rem"));
    assert.ok(prompt.includes("lucide.createIcons"));
    assert.ok(prompt.includes("0 emoji"));
  });

  it("encodes anti-slop guidance", () => {
    assert.ok(prompt.includes("centered-hero-of-doom"));
    assert.ok(prompt.includes("layout.hero_layout"));
    assert.ok(prompt.includes("composition_techniques"));
  });

  it("scopes edits to the landing page only", () => {
    assert.ok(prompt.includes("ONLY index.html and styles.css"));
    assert.ok(prompt.includes("Do NOT touch dashboard.html, module pages, or script.js"));
  });

  it("ends with the DONE protocol", () => {
    assert.ok(prompt.includes("DONE"));
  });
});

describe("buildGlowupSystemPrompt with reference", () => {
  const p = buildGlowupSystemPrompt({ brief: "x", referenceUrl: "https://example.com" });
  it("points at the reference, not getokui", () => {
    assert.ok(p.includes(".reference/style.json"));
    assert.ok(p.includes("https://example.com"));
    assert.ok(!p.includes("pick 1–3 references"));
  });
});
