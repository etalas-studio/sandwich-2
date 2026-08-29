import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { normalizeDashBullets } from "./normalize-prose.js";

describe("normalizeDashBullets", () => {
  it("rewrites repeated 'label — description' bullets into 'label: description'", () => {
    const input = [
      "## Actors",
      "- Karyawan — pengguna utama yang melakukan check-in.",
      "- Admin HR — pengguna admin yang mengelola rekap absensi.",
      "- Manager — pengguna admin yang memantau kehadiran tim.",
    ].join("\n");
    const out = normalizeDashBullets(input);
    assert.match(out, /- Karyawan: pengguna utama/);
    assert.match(out, /- Admin HR: pengguna admin yang mengelola/);
    assert.match(out, /- Manager: pengguna admin yang memantau/);
    assert.doesNotMatch(out, /—/);
  });

  it("leaves em dashes in plain prose (not bullet lines) untouched", () => {
    const input = "This is a normal sentence — with an aside — that should stay.";
    assert.equal(normalizeDashBullets(input), input);
  });

  it("leaves one or two dash bullets untouched (not a repeated pattern)", () => {
    const input = "- Actor A — does something.\n- Actor B — does something else.";
    assert.equal(normalizeDashBullets(input), input);
  });

  it("leaves text with no dash bullets untouched", () => {
    const input = "## Overview\n\nJust plain prose, no bullets at all.";
    assert.equal(normalizeDashBullets(input), input);
  });
});
