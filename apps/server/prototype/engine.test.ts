import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatPrototypeSummary } from "./engine.js";

describe("formatPrototypeSummary", () => {
  it("returns the summary unchanged when there is no glowup warning", () => {
    assert.equal(
      formatPrototypeSummary("Generated 5 files: index.html, styles.css", undefined),
      "Generated 5 files: index.html, styles.css",
    );
  });

  it("appends the glowup warning below the summary", () => {
    assert.equal(
      formatPrototypeSummary("Generated 5 files", "polish desain (glowup) gagal"),
      "Generated 5 files\n\nCatatan: polish desain (glowup) gagal",
    );
  });
});
