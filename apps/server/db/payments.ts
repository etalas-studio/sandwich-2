import { eq } from "drizzle-orm";
import { payments } from "./schema.js";
import type { Database } from "./connection.js";
import type { LocalPaymentStatus } from "../pipeline/payment-status.js";

export interface Payment {
  orderId: string;
  userId: string | null;
  planSlug: string | null;
  localStatus: string;
  transactionStatus: string;
  statusCode: string;
  grossAmount: string;
  paymentType: string | null;
  fraudStatus: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  orderId: string;
  userId: string;
  planSlug: string;
  grossAmount: number;
  localStatus?: LocalPaymentStatus;
}

/**
 * Persist a payment attempt BEFORE calling Midtrans so a provider failure
 * never leaves the order in an unidentified state (per skill: create the
 * `creating_payment` row first).
 */
export async function createPayment(db: Database, input: CreatePaymentInput): Promise<void> {
  await db.insert(payments).values({
    orderId: input.orderId,
    userId: input.userId,
    planSlug: input.planSlug,
    localStatus: input.localStatus ?? "creating_payment",
    transactionStatus: "pending",
    statusCode: "0",
    grossAmount: String(input.grossAmount),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getPayment(db: Database, orderId: string): Promise<Payment | null> {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}

export interface PaymentPatch {
  localStatus?: string;
  transactionStatus?: string;
  statusCode?: string;
  grossAmount?: string;
  paymentType?: string | null;
  fraudStatus?: string | null;
  snapToken?: string | null;
  redirectUrl?: string | null;
  expiresAt?: Date | null;
  updatedAt?: Date;
}

export async function updatePayment(
  db: Database,
  orderId: string,
  patch: PaymentPatch,
): Promise<void> {
  await db.update(payments).set({ ...patch, updatedAt: new Date() }).where(eq(payments.orderId, orderId));
}
