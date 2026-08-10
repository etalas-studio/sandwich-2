import { createHash } from "node:crypto";

/**
 * Snap sandbox/production base URL toggle. Sandbox by default — matches
 * the SB-Mid- prefixed keys issued for testing.
 */
function snapBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export interface SnapTransactionInput {
  orderId: string;
  grossAmount: number;
  itemName: string;
}

export interface SnapTransactionResult {
  token: string;
  redirectUrl: string;
}

export async function createSnapTransaction(
  input: SnapTransactionInput,
): Promise<SnapTransactionResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const auth = Buffer.from(`${serverKey}:`).toString("base64");

  const res = await fetch(`${snapBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.grossAmount,
      },
      item_details: [
        { id: input.orderId, price: input.grossAmount, quantity: 1, name: input.itemName },
      ],
    }),
  });

  const body = (await res.json()) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !body.token || !body.redirect_url) {
    throw new Error(body.error_messages?.join(", ") ?? `Midtrans error (${String(res.status)})`);
  }
  return { token: body.token, redirectUrl: body.redirect_url };
}

/** Per Midtrans docs: SHA512(order_id + status_code + gross_amount + ServerKey). */
export function verifyNotificationSignature(notification: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = createHash("sha512")
    .update(notification.order_id + notification.status_code + notification.gross_amount + serverKey)
    .digest("hex");
  return expected === notification.signature_key;
}
