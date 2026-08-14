import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseRollbackIntent } from "./rollback.js";

describe("parseRollbackIntent", () => {
  it("detects previous", () => {
    assert.equal(parseRollbackIntent("rollback"), "previous");
    assert.equal(parseRollbackIntent("balikin versi sebelumnya"), "previous");
    assert.equal(parseRollbackIntent("versi sebelum"), "previous");
    assert.equal(parseRollbackIntent("UNDO"), "previous");
  });

  it("detects latest", () => {
    assert.equal(parseRollbackIntent("latest"), "latest");
    assert.equal(parseRollbackIntent("balik ke versi latest"), "latest");
    assert.equal(parseRollbackIntent("versi terbaru"), "latest");
  });

  it("returns null for normal instructions", () => {
    assert.equal(parseRollbackIntent("ubah warna tombol jadi merah"), null);
    assert.equal(parseRollbackIntent(""), null);
  });
});
