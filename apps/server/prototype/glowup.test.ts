import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildGlowupSystemPrompt, glowupEventLogLine, glowupModelId, selectReferences } from "./glowup.js";

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

  it("injects pre-selected DNA instead of telling the model to read the library", () => {
    const withRefs = buildGlowupSystemPrompt({
      brief: "A SaaS for warehouse inventory",
      refs: [
        {
          slug: "saas-inventory",
          dna: {
            layout: { hero_layout: "split" },
            motion: { keyframes_css: "@keyframes float {}" },
          },
        },
      ],
    });
    assert.ok(withRefs.includes("Design DNA"));
    assert.ok(withRefs.includes("saas-inventory"));
    assert.ok(withRefs.includes("@keyframes float"));
    assert.ok(!withRefs.includes("Read .getokui/index.json"));
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

describe("glowupEventLogLine", () => {
  it("logs tool start with elapsed seconds", () => {
    const line = glowupEventLogLine({ type: "tool_execution_start", toolName: "read" }, 1250);
    assert.ok(line, "should produce a log line");
    assert.ok(line!.startsWith("[glowup] +1.3s tool_start=read"));
  });

  it("logs tool end with error flag", () => {
    const line = glowupEventLogLine({ type: "tool_execution_end", toolName: "edit", isError: true }, 2500);
    assert.ok(line!.includes("tool_end=edit"));
    assert.ok(line!.includes("isError=true"));
  });

  it("logs agent end errors", () => {
    const line = glowupEventLogLine({ type: "agent_end", errorMessage: "boom" }, 500);
    assert.ok(line!.includes("agent_end"));
    assert.ok(line!.includes("error=boom"));
  });

  it("ignores other events", () => {
    assert.equal(glowupEventLogLine({ type: "message_update" }, 100), null);
  });
});

describe("selectReferences", () => {
  const templates = [
    { slug: "saas-inventory", name: "SaasInventory", category: "saas", tags: ["saas", "inventory"], description: "warehouse inventory SaaS platform" },
    { slug: "fintech-pay", name: "FinPay", category: "fintech", tags: ["fintech", "payment"], description: "payment gateway fintech" },
    { slug: "agency-dark", name: "AgencyDark", category: "agency", tags: ["agency", "creative", "dark"], description: "creative agency studio" },
  ];

  it("picks references matching the brief vertical", () => {
    const got = selectReferences("SaaS untuk warehouse inventory", templates);
    assert.deepEqual(got.map((t) => t.slug), ["saas-inventory"]);
  });

  it("falls back to the first N when nothing matches", () => {
    const got = selectReferences("xyzzy quux", templates, 2);
    assert.deepEqual(got.map((t) => t.slug), ["saas-inventory", "fintech-pay"]);
  });
});
