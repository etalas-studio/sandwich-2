import type { Router } from "../router.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getUserById } from "../db/users.js";
import {
  createSnapTransaction,
  getTransactionStatus,
  verifyNotificationSignature,
} from "../pipeline/midtrans.js";
import {
  mapTransactionStatus,
  shouldTransition,
  type LocalPaymentStatus,
} from "../pipeline/payment-status.js";
import { getPlan, generateOrderId } from "../pipeline/plans.js";
import { createPayment, getPayment, updatePayment } from "../db/payments.js";
import {
  activateSubscription,
  cancelSubscription,
  getActiveSubscription,
} from "../db/repo/subscriptions.js";
import type { Database } from "../db/connection.js";

export function registerMidtransRoutes(router: Router, db: Database): void {
  router.post("/api/midtrans/transaction", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      planSlug?: string;
    } | null;
    const plan = body?.planSlug ? getPlan(body.planSlug) : undefined;
    if (!plan) {
      sendJson(res, 400, { error: "planSlug must be 'starter' or 'pro'" });
      return;
    }

    // Server-side order id + price (never trust client amounts).
    const orderId = generateOrderId(plan.slug, auth.userId);
    // Snap JS config travels with the response so the popup flow never needs
    // a separate (auth-dependent) config round trip.
    const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? "";
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

    // Free tier — no Midtrans call (Midtrans rejects `gross_amount = 0`).
    // Just ensure an active Starter subscription exists, then return.
    if (plan.amount === 0) {
      const existing = await getActiveSubscription(db, auth.userId);
      if (!existing) {
        await activateSubscription(db, { userId: auth.userId, planSlug: plan.slug });
      }
      sendJson(res, 200, {
        token: null,
        redirectUrl: null,
        orderId,
        simulated: false,
        free: true,
        clientKey,
        isProduction,
      });
      return;
    }

    try {
      // Persist `creating_payment` BEFORE any provider call.
      await createPayment(db, {
        orderId,
        userId: auth.userId,
        planSlug: plan.slug,
        grossAmount: plan.amount,
      });

      const user = await getUserById(db, auth.userId);
      const result = await createSnapTransaction({
        orderId,
        grossAmount: plan.amount,
        itemName: `SANDWICH ${plan.name}`,
        customerEmail: user?.email,
      });

      await updatePayment(db, orderId, {
        localStatus: "awaiting_payment",
        snapToken: result.token,
        redirectUrl: result.redirectUrl,
      });

      sendJson(res, 200, {
        token: result.token,
        redirectUrl: result.redirectUrl,
        orderId,
        simulated: false,
        clientKey,
        isProduction,
      });
    } catch (err) {
      // Row stays in `creating_payment`, so the attempt is recoverable.
      sendCaughtError(res, err, "midtrans create transaction");
    }
  });

  // Owner-scoped payment lookup — used to recover pending payment
  // instructions (VA number / QR / payment code) after a redirect back.
  router.get("/api/payments/:orderId", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const payment = await getPayment(db, params.orderId!);
    if (!payment || payment.userId !== auth.userId) {
      sendJson(res, 404, { error: "payment not found" });
      return;
    }
    let providerData: unknown = {};
    if (payment.providerData) {
      try {
        providerData = JSON.parse(payment.providerData);
      } catch {
        providerData = {};
      }
    }
    sendJson(res, 200, {
      orderId: payment.orderId,
      localStatus: payment.localStatus,
      transactionStatus: payment.transactionStatus,
      grossAmount: payment.grossAmount,
      paymentType: payment.paymentType,
      fraudStatus: payment.fraudStatus,
      providerData,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  });

  // Confirm a payment by asking Midtrans directly. The webhook cannot reach
  // localhost, so the Snap success callback and the return page use this to
  // fulfill the subscription server-side.
  router.post("/api/midtrans/verify", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      orderId?: string;
    } | null;
    const orderId = body?.orderId;
    if (!orderId) {
      sendJson(res, 400, { error: "orderId is required" });
      return;
    }

    const payment = await getPayment(db, orderId);
    if (!payment || payment.userId !== auth.userId) {
      sendJson(res, 404, { error: "payment not found" });
      return;
    }

    try {
      const status = await getTransactionStatus(orderId);
      const incoming = mapTransactionStatus(
        status.transactionStatus,
        status.fraudStatus,
      );

      if (shouldTransition(payment.localStatus as LocalPaymentStatus, incoming)) {
        await updatePayment(db, orderId, {
          localStatus: incoming,
          transactionStatus: status.transactionStatus,
          statusCode: "200",
          paymentType: status.paymentType,
          fraudStatus: status.fraudStatus,
        });

        if (incoming === "paid" && payment.userId && payment.planSlug) {
          await activateSubscription(db, {
            userId: payment.userId,
            planSlug: payment.planSlug,
          });
        }
        if (incoming === "refunded" && payment.userId) {
          await cancelSubscription(db, payment.userId);
        }
      }

      sendJson(res, 200, {
        orderId,
        localStatus: incoming,
        transactionStatus: status.transactionStatus,
        active: incoming === "paid",
      });
    } catch (err) {
      sendCaughtError(res, err, "midtrans verify");
    }
  });

  router.post("/api/midtrans/notification", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !body ||
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

    const orderId = body.order_id;
    const payment = await getPayment(db, orderId);
    if (!payment) {
      // Unknown order id — accept without action; there is no user mapping.
      console.warn(`midtrans notification for unknown order_id=${orderId}`);
      sendJson(res, 200, { received: true });
      return;
    }

    const incoming = mapTransactionStatus(
      typeof body.transaction_status === "string"
        ? body.transaction_status
        : "pending",
      typeof body.fraud_status === "string" ? body.fraud_status : null,
    );

    // Idempotent + monotonic: never regress paid/refunded, never double-run.
    if (!shouldTransition(payment.localStatus as LocalPaymentStatus, incoming)) {
      sendJson(res, 200, { received: true });
      return;
    }

    try {
      await updatePayment(db, orderId, {
        localStatus: incoming,
        transactionStatus:
          typeof body.transaction_status === "string"
            ? body.transaction_status
            : "pending",
        statusCode: body.status_code,
        grossAmount: body.gross_amount,
        paymentType:
          typeof body.payment_type === "string" ? body.payment_type : null,
        fraudStatus:
          typeof body.fraud_status === "string" ? body.fraud_status : null,
        // Persist the verified payload so pending instructions (VA number,
        // QR, payment code) survive a page refresh.
        providerData: JSON.stringify(body),
      });

      // Fulfill only on the verified transition into `paid`, server-side.
      if (incoming === "paid" && payment.userId && payment.planSlug) {
        await activateSubscription(db, {
          userId: payment.userId,
          planSlug: payment.planSlug,
        });
      }

      // Full refund revokes access; partial refund only records the state.
      if (incoming === "refunded" && payment.userId) {
        await cancelSubscription(db, payment.userId);
      }
    } catch (err) {
      // 500 so Midtrans retries; the notification was not safely accepted.
      sendCaughtError(res, err, "midtrans persist notification");
      return;
    }

    sendJson(res, 200, { received: true });
  });
}
