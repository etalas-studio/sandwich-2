import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { getPlan, generateOrderId } from "./plans.js";

describe("getPlan", () => {
  it("returns the paid starter plan config", () => {
    const plan = getPlan("starter");
    assert.ok(plan);
    assert.equal(plan.amount, 50000);
    assert.equal(plan.documentLimit, 5);
    assert.equal(plan.prototypeLimit, null);
    assert.equal(plan.chatLimit, 100);
    assert.equal(plan.periodDays, 30);
  });

  it("returns the pro plan config with unlimited quota", () => {
    const plan = getPlan("pro");
    assert.ok(plan);
    assert.equal(plan.amount, 100000);
    assert.equal(plan.documentLimit, null);
    assert.equal(plan.prototypeLimit, null);
    assert.equal(plan.chatLimit, null);
    assert.equal(plan.periodDays, 30);
  });

  it("returns undefined for unknown slugs", () => {
    assert.equal(getPlan("enterprise"), undefined);
    assert.equal(getPlan(""), undefined);
    assert.equal(getPlan("PRO"), undefined);
  });
});

describe("generateOrderId", () => {
  it("prefixes with the plan slug and embeds a user prefix", () => {
    const id = generateOrderId("starter", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.ok(id.startsWith("starter-aaaaaaaa-"), `unexpected order id: ${id}`);
  });

  it("only uses Midtrans-safe characters", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateOrderId("pro", "user-1234");
      assert.match(id, /^[a-z0-9-]+$/, `unsafe order id: ${id}`);
    }
  });

  it("is unique across rapid calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateOrderId("starter", "u-1");
      assert.equal(seen.has(id), false, `duplicate order id: ${id}`);
      seen.add(id);
    }
  });
});
