import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { hashToken } from "./token.js";

describe("hashToken", () => {
  it("is deterministic", () => {
    assert.equal(hashToken("abc"), hashToken("abc"));
  });

  it("produces a 64-char hex sha256", () => {
    assert.match(hashToken("abc"), /^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", () => {
    assert.notEqual(hashToken("a"), hashToken("b"));
  });
});
