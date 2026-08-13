import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mapTransactionStatus, shouldTransition } from "./payment-status.js";

describe("mapTransactionStatus", () => {
  it("maps settlement to paid", () => {
    assert.equal(mapTransactionStatus("settlement", null), "paid");
  });

  it("maps capture + accept to paid, deny to failed, challenge to awaiting", () => {
    assert.equal(mapTransactionStatus("capture", "accept"), "paid");
    assert.equal(mapTransactionStatus("capture", "deny"), "failed");
    assert.equal(mapTransactionStatus("capture", "challenge"), "awaiting_payment");
  });

  it("maps pending to awaiting_payment", () => {
    assert.equal(mapTransactionStatus("pending", null), "awaiting_payment");
  });

  it("maps deny/cancel/expire/failure to terminal failures", () => {
    assert.equal(mapTransactionStatus("deny", null), "failed");
    assert.equal(mapTransactionStatus("cancel", null), "cancelled");
    assert.equal(mapTransactionStatus("expire", null), "expired");
    assert.equal(mapTransactionStatus("failure", null), "failed");
  });

  it("maps refund and partial_refund to distinct states", () => {
    assert.equal(mapTransactionStatus("refund", null), "refunded");
    assert.equal(mapTransactionStatus("partial_refund", null), "partially_refunded");
  });

  it("maps unknown statuses to awaiting_payment (never fatal)", () => {
    assert.equal(mapTransactionStatus("something_else", null), "awaiting_payment");
  });
});

describe("shouldTransition (monotonic guard)", () => {
  it("advances forward through the happy path", () => {
    assert.equal(shouldTransition("creating_payment", "awaiting_payment"), true);
    assert.equal(shouldTransition("awaiting_payment", "paid"), true);
    assert.equal(shouldTransition("paid", "refunded"), true);
  });

  it("allows moving into a failure state", () => {
    assert.equal(shouldTransition("awaiting_payment", "failed"), true);
    assert.equal(shouldTransition("awaiting_payment", "cancelled"), true);
    assert.equal(shouldTransition("awaiting_payment", "expired"), true);
  });

  it("never regresses paid into a pending/failure state", () => {
    assert.equal(shouldTransition("paid", "awaiting_payment"), false);
    assert.equal(shouldTransition("paid", "failed"), false);
    assert.equal(shouldTransition("paid", "cancelled"), false);
    assert.equal(shouldTransition("paid", "expired"), false);
  });

  it("treats refunded as terminal", () => {
    assert.equal(shouldTransition("refunded", "paid"), false);
    assert.equal(shouldTransition("refunded", "awaiting_payment"), false);
    assert.equal(shouldTransition("refunded", "refunded"), false);
  });

  it("is idempotent — same state is a no-op", () => {
    assert.equal(shouldTransition("paid", "paid"), false);
    assert.equal(shouldTransition("awaiting_payment", "awaiting_payment"), false);
  });

  it("allows a late settlement to win over a stale failure", () => {
    assert.equal(shouldTransition("failed", "paid"), true);
    assert.equal(shouldTransition("expired", "paid"), true);
  });

  it("moves refunds forward only", () => {
    assert.equal(shouldTransition("paid", "partially_refunded"), true);
    assert.equal(shouldTransition("partially_refunded", "refunded"), true);
    assert.equal(shouldTransition("partially_refunded", "paid"), false);
    assert.equal(shouldTransition("paid", "refunded"), true);
  });
});
