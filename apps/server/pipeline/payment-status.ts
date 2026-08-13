/**
 * Local payment state model (Snap). Mirrors the states required by the
 * Midtrans integration skill: an order is moved to `creating_payment`
 * BEFORE any provider call, then `awaiting_payment`, then a terminal
 * state driven only by verified notifications.
 */
export type LocalPaymentStatus =
  | "creating_payment"
  | "awaiting_payment"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

/**
 * Map Midtrans `transaction_status` (+ `fraud_status` for capture) to our
 * local state. Deny/cancel/expire/failure are terminal failures; refund
 * states map to refunded.
 */
export function mapTransactionStatus(
  transactionStatus: string,
  fraudStatus: string | null,
): LocalPaymentStatus {
  switch (transactionStatus) {
    case "settlement":
      return "paid";
    case "capture":
      if (fraudStatus === "accept") return "paid";
      if (fraudStatus === "deny") return "failed";
      return "awaiting_payment";
    case "pending":
      return "awaiting_payment";
    case "deny":
      return "failed";
    case "cancel":
      return "cancelled";
    case "expire":
      return "expired";
    case "failure":
      return "failed";
    case "refund":
    case "partial_refund":
      return "refunded";
    default:
      return "awaiting_payment";
  }
}

/**
 * Monotonic ordering — a callback must never regress local state.
 * `paid` outranks the failure states (a late settlement after a stale
 * failure still fulfills), but a `pending`/`cancel`/`expire` must never
 * overwrite `paid`, and `refunded` is final.
 */
const RANK: Record<LocalPaymentStatus, number> = {
  creating_payment: 0,
  awaiting_payment: 1,
  failed: 2,
  cancelled: 2,
  expired: 2,
  paid: 3,
  refunded: 4,
};

export function shouldTransition(
  current: LocalPaymentStatus,
  incoming: LocalPaymentStatus,
): boolean {
  if (incoming === current) return false; // no-op, preserves idempotency
  if (current === "refunded") return false; // terminal
  if (current === "paid" && incoming !== "refunded") return false;
  return RANK[incoming] >= RANK[current];
}
