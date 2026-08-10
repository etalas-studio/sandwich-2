import type { Router } from "../router.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { createSnapTransaction, verifyNotificationSignature } from "../pipeline/midtrans.js";

export function registerMidtransRoutes(router: Router): void {
  router.post("/api/midtrans/transaction", async (req, res) => {
    const body = (await readJsonBody(req)) as Partial<{
      orderId: string;
      grossAmount: number;
      itemName: string;
    }>;
    if (
      typeof body.orderId !== "string" ||
      !body.orderId ||
      typeof body.grossAmount !== "number" ||
      !(body.grossAmount > 0)
    ) {
      sendJson(res, 400, { error: "orderId (string) and grossAmount (positive number) are required" });
      return;
    }
    try {
      const result = await createSnapTransaction({
        orderId: body.orderId,
        grossAmount: body.grossAmount,
        itemName: typeof body.itemName === "string" && body.itemName ? body.itemName : body.orderId,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendCaughtError(res, err, "midtrans create transaction");
    }
  });

  // Called by Midtrans directly, no session — trust only a valid signature.
  router.post("/api/midtrans/notification", async (req, res) => {
    const body = (await readJsonBody(req)) as Partial<{
      order_id: string;
      status_code: string;
      gross_amount: string;
      signature_key: string;
      transaction_status: string;
    }>;
    if (
      typeof body.order_id !== "string" ||
      typeof body.status_code !== "string" ||
      typeof body.gross_amount !== "string" ||
      typeof body.signature_key !== "string"
    ) {
      sendJson(res, 400, { error: "invalid notification payload" });
      return;
    }
    if (
      !verifyNotificationSignature({
        order_id: body.order_id,
        status_code: body.status_code,
        gross_amount: body.gross_amount,
        signature_key: body.signature_key,
      })
    ) {
      sendJson(res, 401, { error: "invalid signature" });
      return;
    }
    console.log(`midtrans notification: order=${body.order_id} status=${body.transaction_status ?? "?"}`);
    sendJson(res, 200, { received: true });
  });
}
