import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  detectDeliverableType,
  detectPreviewIntent,
  detectRefineIntent,
  hasLogoAndColorDetails,
  stageInstruction,
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

  it("detects broadened synonyms", () => {
    assert.equal(detectDeliverableType("buatin mockup dashboard"), "prototype");
    assert.equal(detectDeliverableType("bikin wireframe aja dulu"), "prototype");
    assert.equal(detectDeliverableType("buatkan aplikasi POS"), "prototype");
    assert.equal(detectDeliverableType("mau dokumen kebutuhan produknya"), "prd");
    assert.equal(detectDeliverableType("kirim rincian biaya dong"), "quotation");
    assert.equal(detectDeliverableType("bikinin daftar fitur"), "specs");
    assert.equal(detectDeliverableType("mau lihat roadmap fitur"), "specs");
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

describe("stageInstruction", () => {
  it("forces logo + color palette questions when clarifying a prototype", () => {
    const instruction = stageInstruction("clarifying", "prototype");
    assert.match(instruction, /logo/i);
    assert.match(instruction, /color palette|brand colors/i);
  });

  it("tells the model NOT to ask about timeline for a prototype", () => {
    const instruction = stageInstruction("clarifying", "prototype");
    assert.match(instruction, /do not ask about timeline/i);
  });

  it("keeps the generic clarifying instruction (incl. timeline) for non-prototype deliverables", () => {
    const instruction = stageInstruction("clarifying", "prd");
    assert.doesNotMatch(instruction, /logo/i);
    assert.match(instruction, /timeline/i);
  });
});

describe("hasLogoAndColorDetails", () => {
  it("requires both logo and color mentions", () => {
    assert.equal(hasLogoAndColorDetails("logonya pakai teks aja, warna biru putih"), true);
    assert.equal(hasLogoAndColorDetails("Logo: upload nanti. Brand colors: navy + gold."), true);
  });

  it("returns false when only one of the two is mentioned", () => {
    assert.equal(hasLogoAndColorDetails("logonya pakai teks aja"), false);
    assert.equal(hasLogoAndColorDetails("warna biru putih ya"), false);
  });

  it("returns false when neither is mentioned", () => {
    assert.equal(hasLogoAndColorDetails("Buatkan prototype aplikasi POS untuk kasir"), false);
  });
});
