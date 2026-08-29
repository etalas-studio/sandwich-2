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
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled"
  | "expired";

/**
 * Map Midtrans `transaction_status` (+ `fraud_status` for capture) to our
 * local state. Deny/cancel/expire/failure are terminal failures; refund
 * states map to partially_refunded / refunded.
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
      return "refunded";
    case "partial_refund":
      return "partially_refunded";
    default:
      return "awaiting_payment";
  }
}

/**
 * Monotonic ordering — a callback must never regress local state.
 * `paid` outranks the failure states (a late settlement after a stale
 * failure still fulfills), while refund states only move forward and
 * `refunded` is terminal.
 */
const RANK: Record<LocalPaymentStatus, number> = {
  creating_payment: 0,
  awaiting_payment: 1,
  failed: 2,
  cancelled: 2,
  expired: 2,
  paid: 3,
  partially_refunded: 4,
  refunded: 5,
};

export function shouldTransition(
  current: LocalPaymentStatus,
  incoming: LocalPaymentStatus,
): boolean {
  if (incoming === current) return false; // no-op, preserves idempotency
  return RANK[incoming] >= RANK[current];
}
