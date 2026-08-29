import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createToolBudget } from "./budget.js";

describe("createToolBudget — ceiling", () => {
  it("fires on the (max+1)th tool call and latches", () => {
    const b = createToolBudget({ maxToolCalls: 3, inactivityMs: 60_000 });
    let t = 0;
    for (let i = 0; i < 3; i++) {
      assert.equal(b.onEvent("tool_execution_start", (t += 100)), "ok");
    }
    assert.equal(b.onEvent("tool_execution_start", (t += 100)), "ceiling");
    assert.equal(b.toolCalls, 4);
    // latched — a later well-behaved event still reports ceiling
    assert.equal(b.onEvent("message_update", (t += 100)), "ceiling");
    assert.equal(b.verdict, "ceiling");
  });

  it("does not count non-tool events", () => {
    const b = createToolBudget({ maxToolCalls: 2, inactivityMs: 60_000 });
    let t = 0;
    for (const type of ["turn_start", "message_update", "message_end", "tool_execution_end"]) {
      assert.equal(b.onEvent(type, (t += 100)), "ok");
    }
    assert.equal(b.toolCalls, 0);
  });
});

describe("createToolBudget — stall", () => {
  it("fires when the gap between two events exceeds inactivityMs", () => {
    const b = createToolBudget({ maxToolCalls: 10, inactivityMs: 5_000 });
    assert.equal(b.onEvent("turn_start", 1_000), "ok");
    assert.equal(b.onEvent("message_update", 4_000), "ok"); // 3s gap, fine
    assert.equal(b.onEvent("message_update", 10_500), "stalled"); // 6.5s gap
  });

  it("check() notices a stall with no further events", () => {
    const b = createToolBudget({ maxToolCalls: 10, inactivityMs: 5_000 });
    b.onEvent("tool_execution_start", 1_000);
    assert.equal(b.check(4_000), "ok");
    assert.equal(b.check(7_000), "stalled");
  });

  it("every event type resets the inactivity deadline", () => {
    const b = createToolBudget({ maxToolCalls: 10, inactivityMs: 5_000 });
    let t = 0;
    for (const type of ["turn_start", "message_start", "message_update", "tool_execution_start", "tool_execution_end", "message_end"]) {
      assert.equal(b.onEvent(type, (t += 4_000)), "ok");
    }
    assert.equal(b.check(t + 4_000), "ok");
    assert.equal(b.check(t + 6_000), "stalled");
  });

  it("does not stall before the first event", () => {
    const b = createToolBudget({ maxToolCalls: 10, inactivityMs: 1_000 });
    assert.equal(b.check(1_000_000), "ok");
  });
});
