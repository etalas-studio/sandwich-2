import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { selectReference, buildReferenceBlock } from "./references.js";

describe("selectReference", () => {
  it("picks the PRD reference whose tags best match the brief", () => {
    const ref = selectReference(
      "prd",
      "Kami mau bikin platform escrow untuk marketplace C2C, buyer seller dispute resolution",
    );
    assert.ok(ref);
    assert.equal(ref?.slug, "bayarin-aja");
  });

  it("picks the quotation reference whose tags best match the brief", () => {
    const ref = selectReference("quotation", "fleet logistics enterprise b2b integration mvp");
    assert.ok(ref);
    assert.equal(ref?.slug, "grab-fleet-portal");
  });

  it("falls back to the first reference when nothing matches", () => {
    const ref = selectReference("prd", "zzz unrelated brief zzz");
    assert.ok(ref);
  });
});

describe("buildReferenceBlock", () => {
  it("wraps the selected reference with anti-hallucination instructions", () => {
    const block = buildReferenceBlock("quotation", "fleet logistics enterprise b2b integration mvp");
    assert.match(block, /do not copy client names/i);
    assert.match(block, /Fleet Partnership Portal/i);
  });
});
