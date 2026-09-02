import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { sendCaughtErrorExpress } from "../../http-utils.js";
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
      res.status(401).json({ error: "unauthenticated" });
      return;
    }

    const body = req.body as {
      planSlug?: string;
    } | null;
    const plan = body?.planSlug ? getPlan(body.planSlug) : undefined;
    if (!plan) {
      res.status(400).json({ error: "planSlug must be 'starter' or 'pro'" });
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
      res.status(200).json({ orderId, simulated: true, clientKey, isProduction });
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
        itemName: `Spectr ${plan.name}`,
        customerEmail: user?.email,
      });

      await updatePayment(db, orderId, {
        localStatus: "awaiting_payment",
        snapToken: result.token,
        redirectUrl: result.redirectUrl,
      });

      res.status(200).json({
        token: result.token,
        redirectUrl: result.redirectUrl,
        orderId,
        simulated: false,
        clientKey,
        isProduction,
      });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "midtrans create transaction");
    }
  });

  router.get("/api/payments/:orderId", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const payment = await getPayment(db, req.params.orderId!);
    if (!payment || payment.userId !== auth.userId) {
      res.status(404).json({ error: "payment not found" });
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
    res.status(200).json({
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
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const body = req.body as { orderId?: string } | null;
    const orderId = body?.orderId?.trim() ?? "";
    if (!orderId) {
      res.status(400).json({ error: "orderId is required" });
      return;
    }
    const payment = await getPayment(db, orderId);
    if (!payment || payment.userId !== auth.userId) {
      res.status(404).json({ error: "payment not found" });
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
      res.status(200).json({
        orderId,
        localStatus,
        transactionStatus: status.transactionStatus,
        active: localStatus === "paid",
      });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "midtrans verify");
    }
  });

  router.post("/api/midtrans/notification", async (req, res) => {
    const body = req.body as Record<string, unknown> | null;

    if (
      !body ||
      typeof body.order_id !== "string" ||
      typeof body.status_code !== "string" ||
      typeof body.gross_amount !== "string" ||
      typeof body.signature_key !== "string"
    ) {
      res.status(400).json({ error: "invalid notification payload" });
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
      res.status(400).json({ error: "invalid signature" });
      return;
    }

    const orderId = body.order_id;
    const payment = await getPayment(db, orderId);
    if (!payment) {
      res.status(200).json({ received: true });
      return;
    }

    const incoming = mapTransactionStatus(
      typeof body.transaction_status === "string" ? body.transaction_status : "",
      typeof body.fraud_status === "string" ? body.fraud_status : null,
    );

    // Never regress paid/refunded, never double-run.
    if (!shouldTransition(payment.localStatus as LocalPaymentStatus, incoming)) {
      res.status(200).json({ received: true });
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
      sendCaughtErrorExpress(res, err, "midtrans persist notification");
      return;
    }

    res.status(200).json({ received: true });
  });

  // ── Usage ─────────────────────────────────────────────────────────────────

  router.get("/api/usage", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
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
    res.status(200).json({
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
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    if (!sub) {
      const any = await getSubscriptionForUser(db, auth.userId);
      res.status(200).json({ planSlug: null, expired: !!any });
      return;
    }
    res.status(200).json({
      planSlug: sub.planSlug,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      expired: false,
    });
  });
}
