import { eq } from "drizzle-orm";
import { payments } from "./schema.js";
import type { Database } from "./connection.js";

export interface Payment {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  updated_at: string;
}

export async function upsertPayment(db: Database, payment: Payment): Promise<void> {
  await db.insert(payments).values({
    orderId: payment.order_id,
    transactionStatus: payment.transaction_status,
    statusCode: payment.status_code,
    grossAmount: payment.gross_amount,
    updatedAt: new Date(payment.updated_at),
  }).onConflictDoUpdate({
    target: payments.orderId,
    set: {
      transactionStatus: payment.transaction_status,
      statusCode: payment.status_code,
      grossAmount: payment.gross_amount,
      updatedAt: new Date(payment.updated_at),
    },
  });
}

export async function getPayment(db: Database, orderId: string): Promise<Payment | undefined> {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  if (rows.length === 0) return undefined;
  const r = rows[0]!;
  return {
    order_id: r.orderId,
    transaction_status: r.transactionStatus,
    status_code: r.statusCode,
    gross_amount: r.grossAmount,
    updated_at: r.updatedAt.toISOString(),
  };
}
