import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatPrototypeSummary, verifyPrototypeOutput } from "./engine.js";

describe("formatPrototypeSummary", () => {
  it("returns the summary unchanged when there is no warning", () => {
    assert.equal(formatPrototypeSummary("Prototype dibuat.", undefined), "Prototype dibuat.");
  });

  it("appends the warning below the summary", () => {
    assert.equal(
      formatPrototypeSummary("Prototype dibuat.", "terhenti lebih awal"),
      "Prototype dibuat.\n\nCatatan: terhenti lebih awal",
    );
  });
});

describe("verifyPrototypeOutput", () => {
  function withDir(fn: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "proto-verify-"));
    try {
      mkdirSync(join(dir, "prototype"));
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("is false when the file is missing", () => {
    withDir((dir) => assert.equal(verifyPrototypeOutput(dir), false));
  });

  it("is false when the file is too small or not HTML", () => {
    withDir((dir) => {
      writeFileSync(join(dir, "prototype", "index.html"), "hi");
      assert.equal(verifyPrototypeOutput(dir), false);
    });
    withDir((dir) => {
      writeFileSync(join(dir, "prototype", "index.html"), "plain text ".repeat(40));
      assert.equal(verifyPrototypeOutput(dir), false);
    });
  });

  it("is true for a real-looking HTML document", () => {
    withDir((dir) => {
      writeFileSync(
        join(dir, "prototype", "index.html"),
        "<!doctype html><html><head><style>body{}</style></head><body><div>" +
          "content ".repeat(40) +
          "</div></body></html>",
      );
      assert.equal(verifyPrototypeOutput(dir), true);
    });
  });
});
