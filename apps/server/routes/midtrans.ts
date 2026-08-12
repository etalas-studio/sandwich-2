import type { Router } from "../router.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { authenticateRequest } from "../auth/middleware.js";
import { createSnapTransaction, verifyNotificationSignature } from "../pipeline/midtrans.js";
import { upsertPayment } from "../db/payments.js";
import type { Database } from "../db/connection.js";

export function registerMidtransRoutes(router: Router, db: Database): void {
  router.get("/api/midtrans/config", (_req, res) => {
    sendJson(res, 200, {
      clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    });
  });

  router.post("/api/midtrans/transaction", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
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
    try {
      await upsertPayment(db, {
        order_id: body.order_id,
        transaction_status: body.transaction_status ?? "unknown",
        status_code: body.status_code,
        gross_amount: body.gross_amount,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      sendCaughtError(res, err, "midtrans persist notification");
      return;
    }
    sendJson(res, 200, { received: true });
  });
}
