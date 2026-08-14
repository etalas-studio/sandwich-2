import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("allows up to max requests within the window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    assert.equal(limiter.check("ip-1"), true);
    assert.equal(limiter.check("ip-1"), true);
    assert.equal(limiter.check("ip-1"), true);
    assert.equal(limiter.check("ip-1"), false);
  });

  it("tracks different keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    assert.equal(limiter.check("ip-a"), true);
    assert.equal(limiter.check("ip-a"), false);
    assert.equal(limiter.check("ip-b"), true);
  });

  it("resets after the window elapses", async () => {
    const limiter = createRateLimiter({ windowMs: 40, max: 1 });
    assert.equal(limiter.check("ip-1"), true);
    assert.equal(limiter.check("ip-1"), false);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(limiter.check("ip-1"), true);
  });
});
