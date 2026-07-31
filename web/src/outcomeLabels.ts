import type { Outcome } from "./types";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  plan_failed: "plan failed",
  plan_timeout: "plan timed out",
  plan_out_of_scope: "out of scope",
  awaiting_plan_approval: "awaiting approval",
  plan_rejected: "plan rejected",
  implementing: "implementing",
  no_changes: "no changes",
  guardrail_blocked: "guardrail blocked",
  tests_failed: "tests failed",
  ready_for_review: "ready for review",
  error: "error",
};
