import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { ownedProject, normaliseTitle, deriveProjectTitle } from "../projects/db.js";

describe("ownedProject predicate", () => {
  it("scopes on BOTH user_id and id, in that order", () => {
    const { sql, params } = new PgDialect().sqlToQuery(ownedProject("user-1", "proj-1"));
    assert.match(sql, /"user_id" = \$\d/);
    assert.match(sql, /"id" = \$\d/);
    // user_id must be part of the predicate — this is the ownership check.
    assert.ok(sql.indexOf("user_id") < sql.indexOf('"id"'));
    assert.deepEqual(params, ["user-1", "proj-1"]);
  });
});

describe("normaliseTitle", () => {
  it("falls back for empty / whitespace / nullish input", () => {
    assert.equal(normaliseTitle(null), "Untitled project");
    assert.equal(normaliseTitle(undefined), "Untitled project");
    assert.equal(normaliseTitle(""), "Untitled project");
    assert.equal(normaliseTitle("   \n\t "), "Untitled project");
  });

  it("collapses whitespace and strips markdown noise", () => {
    assert.equal(normaliseTitle("  ## Build   a\n\n**POS**  app "), "Build a POS app");
  });

  it("truncates on a word boundary with an ellipsis", () => {
    const long =
      "Build a point of sale application for a small coffee shop with inventory tracking and staff scheduling";
    const out = normaliseTitle(long);
    assert.ok(out.length <= 81, `expected <= 81 chars, got ${out.length}`);
    assert.ok(out.endsWith("…"));
    assert.ok(!out.slice(0, -1).endsWith(" "));
  });

  it("leaves a short clean title untouched", () => {
    assert.equal(normaliseTitle("My PRD"), "My PRD");
  });
});

describe("deriveProjectTitle", () => {
  it("prefers an explicit title over the prompt", () => {
    assert.equal(deriveProjectTitle("Coffee POS", "build me something for a cafe"), "Coffee POS");
  });

  it("falls back to the prompt when the title is blank", () => {
    assert.equal(deriveProjectTitle("  ", "build me a cafe POS"), "build me a cafe POS");
    assert.equal(deriveProjectTitle(null, "build me a cafe POS"), "build me a cafe POS");
  });

  it("falls back to the placeholder when both are empty", () => {
    assert.equal(deriveProjectTitle(null, ""), "Untitled project");
  });
});
