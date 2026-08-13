import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildGlowupSystemPrompt } from "./glowup.js";

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

  it("ends with the DONE protocol", () => {
    assert.ok(prompt.includes("DONE"));
  });
});
