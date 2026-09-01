/**
 * Runaway-agent guard for engine runs.
 *
 * PRODUCT.md §6 records that giving the text engine tools once caused hangs.
 * The historical symptom is a *stall* (the agent stops emitting events but the
 * promise never settles), not a tool-call overrun — and the current
 * absolute-timeout-only design makes the user wait the full 3–10 minutes for
 * it. This budget catches both:
 *
 *   - ceiling  — more than `maxToolCalls` tool invocations in one run
 *   - stalled  — no agent event at all for `inactivityMs`
 *
 * It is a pure state machine: no timers, no I/O. The caller feeds it events as
 * they arrive and polls `check(now)` from an interval to notice a stall between
 * events. That keeps it unit-testable with synthetic event sequences.
 */

export type BudgetVerdict = "ok" | "ceiling" | "stalled";

export interface ToolBudgetOptions {
  /** Max `tool_execution_start` events before the run is judged runaway. */
  maxToolCalls: number;
  /** Max gap (ms) between any two agent events before the run is judged stalled. */
  inactivityMs: number;
}

export interface ToolBudget {
  /** Feed an agent event. Returns the verdict as of this event. */
  onEvent(type: string, nowMs: number): BudgetVerdict;
  /** Poll for a stall without an event (drive from setInterval). */
  check(nowMs: number): BudgetVerdict;
  /** Number of tool calls seen so far. */
  readonly toolCalls: number;
  /** The verdict once it leaves "ok"; latched. */
  readonly verdict: BudgetVerdict;
}

export function createToolBudget(opts: ToolBudgetOptions): ToolBudget {
  let toolCalls = 0;
  let lastActivityMs = Number.NEGATIVE_INFINITY;
  let verdict: BudgetVerdict = "ok";

  const settle = (v: BudgetVerdict): BudgetVerdict => {
    if (verdict === "ok" && v !== "ok") verdict = v;
    return verdict;
  };

  return {
    onEvent(type: string, nowMs: number): BudgetVerdict {
      if (verdict !== "ok") return verdict;

      // A late stall check: if the gap since the previous event already blew
      // the inactivity budget, this event arrived too late to save the run.
      if (
        lastActivityMs !== Number.NEGATIVE_INFINITY &&
        nowMs - lastActivityMs > opts.inactivityMs
      ) {
        lastActivityMs = nowMs;
        return settle("stalled");
      }

      lastActivityMs = nowMs;

      if (type === "tool_execution_start") {
        toolCalls += 1;
        if (toolCalls > opts.maxToolCalls) return settle("ceiling");
      }
      return "ok";
    },

    check(nowMs: number): BudgetVerdict {
      if (verdict !== "ok") return verdict;
      if (
        lastActivityMs !== Number.NEGATIVE_INFINITY &&
        nowMs - lastActivityMs > opts.inactivityMs
      ) {
        return settle("stalled");
      }
      return "ok";
    },

    get toolCalls() {
      return toolCalls;
    },
    get verdict() {
      return verdict;
    },
  };
}

/**
 * Per-context budgets. Chat stages are read-only and quick; generation writes a
 * file and may consult siblings; the prototype engine legitimately does a lot.
 */
export const TOOL_BUDGETS = {
  chat: { maxToolCalls: 12, inactivityMs: 60_000 },
  text: { maxToolCalls: 40, inactivityMs: 180_000 },
  prototype: { maxToolCalls: 120, inactivityMs: 300_000 },
} as const satisfies Record<string, ToolBudgetOptions>;
