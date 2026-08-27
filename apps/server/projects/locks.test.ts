import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import {
  acquireProjectLease,
  isLease,
  __resetLocalLeases,
} from "./locks.js";
import { RUN_LOCK_TTL_SECS } from "../redis.js";

// No REDIS_URL in the test env → the remote layer is a no-op, so these exercise
// the in-process layer, which is authoritative under the single-instance deploy.

describe("acquireProjectLease", () => {
  beforeEach(() => __resetLocalLeases());

  it("grants the lease, then reports the holder to a different conversation", async () => {
    const a = await acquireProjectLease("proj-1", "conv-a");
    assert.ok(isLease(a));

    const b = await acquireProjectLease("proj-1", "conv-b");
    assert.ok(!isLease(b));
    assert.deepEqual(b, { busyWith: "conv-a" });
  });

  it("is re-entrant for the same conversation", async () => {
    await acquireProjectLease("proj-1", "conv-a");
    const again = await acquireProjectLease("proj-1", "conv-a");
    assert.ok(isLease(again));
  });

  it("frees the project on release", async () => {
    const a = await acquireProjectLease("proj-1", "conv-a");
    assert.ok(isLease(a));
    await a.release();
    const b = await acquireProjectLease("proj-1", "conv-b");
    assert.ok(isLease(b));
  });

  it("release is idempotent", async () => {
    const a = await acquireProjectLease("proj-1", "conv-a");
    assert.ok(isLease(a));
    await a.release();
    await a.release();
  });

  it("steals a stale lease past the TTL", async () => {
    const t0 = 1_000_000;
    const held = await acquireProjectLease("proj-1", "conv-a", t0);
    assert.ok(isLease(held));

    const stillBusy = await acquireProjectLease("proj-1", "conv-b", t0 + 1000);
    assert.ok(!isLease(stillBusy));

    const stolen = await acquireProjectLease(
      "proj-1",
      "conv-b",
      t0 + RUN_LOCK_TTL_SECS * 1000 + 1,
    );
    assert.ok(isLease(stolen));
  });

  it("keeps different projects independent", async () => {
    const a = await acquireProjectLease("proj-1", "conv-a");
    const b = await acquireProjectLease("proj-2", "conv-b");
    assert.ok(isLease(a));
    assert.ok(isLease(b));
  });
});
