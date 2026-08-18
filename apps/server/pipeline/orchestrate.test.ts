import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  detectDeliverableType,
  detectPreviewIntent,
  detectRefineIntent,
} from "./orchestrate.js";

describe("detectDeliverableType", () => {
  it("detects specs in singular and plural forms", () => {
    assert.equal(detectDeliverableType("buat spec aplikasi"), "specs");
    assert.equal(detectDeliverableType("mau specs aja"), "specs");
    assert.equal(detectDeliverableType("bikinin feature breakdown"), "specs");
  });

  it("detects the other deliverable types", () => {
    assert.equal(detectDeliverableType("buatkan prototype POS"), "prototype");
    assert.equal(detectDeliverableType("bikinin PRD"), "prd");
    assert.equal(detectDeliverableType("buat quotation"), "quotation");
  });

  it("returns null for follow-ups and refinements", () => {
    assert.equal(detectDeliverableType("kasih link previewnya dong"), null);
    assert.equal(detectDeliverableType("ubah warnanya jadi biru"), null);
  });
});

describe("detectPreviewIntent", () => {
  it("detects preview/link/url requests", () => {
    assert.equal(detectPreviewIntent("kasih link previewnya"), true);
    assert.equal(detectPreviewIntent("lihat preview dong"), true);
    assert.equal(detectPreviewIntent("mana url-nya"), true);
  });

  it("rejects non-preview messages", () => {
    assert.equal(detectPreviewIntent("buatkan prototype POS"), false);
    assert.equal(detectPreviewIntent("ubah warnanya jadi biru"), false);
  });
});

describe("detectRefineIntent", () => {
  it("detects change/add/fix verbs", () => {
    assert.equal(detectRefineIntent("ubah warnanya jadi biru"), true);
    assert.equal(detectRefineIntent("tambah fitur laporan"), true);
    assert.equal(detectRefineIntent("ganti tema jadi gelap"), true);
  });

  it("rejects non-refine messages", () => {
    assert.equal(detectRefineIntent("kasih link previewnya"), false);
    assert.equal(detectRefineIntent("terima kasih"), false);
  });
});
