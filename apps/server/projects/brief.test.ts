import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBriefMarkdown,
  writeBrief,
  ATTACHMENT_CHAR_CAP,
  type BriefInput,
} from "./brief.js";

const base: BriefInput = {
  title: "Coffee POS",
  turns: [
    { role: "user", content: "Build a POS for a coffee shop" },
    { role: "assistant", content: "Which payment methods do you need?" },
    { role: "user", content: "Cash and QRIS" },
    { role: "assistant", content: "PRD generated — v1" },
  ],
  attachments: [],
};

describe("buildBriefMarkdown", () => {
  it("is deterministic — identical input, byte-identical output", () => {
    assert.equal(buildBriefMarkdown(base), buildBriefMarkdown(structuredClone(base)));
  });

  it("ends with exactly one newline", () => {
    const out = buildBriefMarkdown(base);
    assert.ok(out.endsWith("\n"));
    assert.ok(!out.endsWith("\n\n"));
  });

  it("folds user turns into Request and pairs clarifications", () => {
    const out = buildBriefMarkdown(base);
    assert.match(out, /# Coffee POS/);
    assert.match(out, /## Request\n\nBuild a POS for a coffee shop/);
    assert.match(out, /## Clarifications/);
    assert.match(out, /\*\*Q:\*\* Which payment methods do you need\?/);
    assert.match(out, /\*\*A:\*\* Cash and QRIS/);
  });

  it("never includes assistant deliverable text", () => {
    const out = buildBriefMarkdown({
      ...base,
      turns: [
        { role: "user", content: "make a landing page" },
        { role: "assistant", content: "# Product Requirements\n\nSecret internal content" },
      ],
    });
    assert.doesNotMatch(out, /Secret internal content/);
  });

  it("dedupes consecutive identical user turns", () => {
    const out = buildBriefMarkdown({
      ...base,
      turns: [
        { role: "user", content: "same" },
        { role: "user", content: "same" },
      ],
    });
    assert.equal(out.match(/^same$/gm)?.length, 1);
  });

  it("shows a placeholder when there is no brief yet", () => {
    const out = buildBriefMarkdown({ title: "X", turns: [], attachments: [] });
    assert.match(out, /_No brief provided yet\._/);
  });

  it("truncates a long attachment extract and marks it", () => {
    const out = buildBriefMarkdown({
      ...base,
      attachments: [
        { filename: "spec.pdf", extractStatus: "done", extractedText: "x".repeat(ATTACHMENT_CHAR_CAP + 500) },
      ],
    });
    assert.match(out, /### spec\.pdf/);
    assert.match(out, /extract truncated/);
    assert.ok(!out.includes("x".repeat(ATTACHMENT_CHAR_CAP + 1)));
  });

  it("notes attachments still being extracted", () => {
    const out = buildBriefMarkdown({
      ...base,
      attachments: [{ filename: "voice.m4a", extractStatus: "pending", extractedText: null }],
    });
    assert.match(out, /### voice\.m4a\n\n_\(extraction pending\)_/);
  });
});

describe("writeBrief", () => {
  it("writes BRIEF.md at the project root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brief-"));
    try {
      const path = await writeBrief(dir, buildBriefMarkdown(base));
      assert.equal(path, join(dir, "BRIEF.md"));
      assert.match(readFileSync(path, "utf8"), /# Coffee POS/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
