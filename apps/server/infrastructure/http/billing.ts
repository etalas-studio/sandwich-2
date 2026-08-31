import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
import { sendJson, sendCaughtError, readJsonBody } from "../../http-utils.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { getUserById } from "../../db/users.js";
import {
  createSnapTransaction,
  getTransactionStatus,
  verifyNotificationSignature,
} from "../../billing/midtrans.js";
import {
  mapTransactionStatus,
  shouldTransition,
  type LocalPaymentStatus,
} from "../../billing/payment-status.js";
import { getPlan, generateOrderId } from "../../billing/plans.js";
import { createPayment, getPayment, updatePayment } from "../../db/payments.js";
import {
  activateSubscription,
  cancelSubscription,
  getActiveSubscription,
  getSubscriptionForUser,
} from "../../db/repo/subscriptions.js";
import { getMonthlyUsage } from "../../db/repo/usage.js";
import { PLANS } from "../../billing/plans.js";

export function registerBillingRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  // ── Midtrans ──────────────────────────────────────────────────────────────

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

    const orderId = generateOrderId(plan.slug, auth.userId);
    const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? "";
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

    // Free tier — no Midtrans call needed.
    if (plan.amount === 0) {
      await createPayment(db, {
        orderId,
        userId: auth.userId,
        planSlug: plan.slug,
        grossAmount: 0,
        localStatus: "paid",
      });
      await activateSubscription(db, { userId: auth.userId, planSlug: plan.slug });
      sendJson(res, 200, { orderId, simulated: true, clientKey, isProduction });
      return;
    }

    try {
      await createPayment(db, {
        orderId,
        userId: auth.userId,
        planSlug: plan.slug,
        grossAmount: plan.amount,
        localStatus: "creating_payment",
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
      sendCaughtError(res, err, "midtrans create transaction");
    }
  });

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

  router.post("/api/midtrans/verify", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthenticated" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as { orderId?: string } | null;
    const orderId = body?.orderId?.trim() ?? "";
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

      const transitioned = shouldTransition(payment.localStatus as LocalPaymentStatus, incoming);
      if (transitioned) {
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

      const localStatus = transitioned ? incoming : (payment.localStatus as LocalPaymentStatus);
      sendJson(res, 200, {
        orderId,
        localStatus,
        transactionStatus: status.transactionStatus,
        active: localStatus === "paid",
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
      sendJson(res, 400, { error: "invalid signature" });
      return;
    }

    const orderId = body.order_id;
    const payment = await getPayment(db, orderId);
    if (!payment) {
      sendJson(res, 200, { received: true });
      return;
    }

    const incoming = mapTransactionStatus(
      typeof body.transaction_status === "string" ? body.transaction_status : "",
      typeof body.fraud_status === "string" ? body.fraud_status : null,
    );

    // Never regress paid/refunded, never double-run.
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
        providerData: JSON.stringify(body),
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
    } catch (err) {
      sendCaughtError(res, err, "midtrans persist notification");
      return;
    }

    sendJson(res, 200, { received: true });
  });

  // ── Usage ─────────────────────────────────────────────────────────────────

  router.get("/api/usage", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    const planSlug = sub?.planSlug ?? null;
    const plan = planSlug ? PLANS[planSlug as keyof typeof PLANS] : undefined;
    const isPro = planSlug === "pro";

    const used = await getMonthlyUsage(db, auth.userId, "doc");
    const prototypeUsed = await getMonthlyUsage(db, auth.userId, "prototype");
    const chatUsed = await getMonthlyUsage(db, auth.userId, "chat");

    const now = new Date();
    sendJson(res, 200, {
      used,
      prototypeUsed,
      chatUsed,
      yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      planSlug,
      isPro,
      limit: isPro ? null : plan ? plan.documentLimit : 0,
      prototypeLimit: isPro ? null : plan ? plan.prototypeLimit : 0,
      chatLimit: isPro ? null : plan ? plan.chatLimit : 0,
    });
  });

  // ── Subscriptions ─────────────────────────────────────────────────────────

  router.get("/api/subscriptions/active", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    if (!sub) {
      const any = await getSubscriptionForUser(db, auth.userId);
      sendJson(res, 200, { planSlug: null, expired: !!any });
      return;
    }
    sendJson(res, 200, {
      planSlug: sub.planSlug,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      expired: false,
    });
  });
}
