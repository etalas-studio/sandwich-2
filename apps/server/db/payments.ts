import type Database from "better-sqlite3";

export interface Payment {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  updated_at: string;
}

export function upsertPayment(db: Database.Database, payment: Payment): void {
  db.prepare(`
    INSERT INTO payments (order_id, transaction_status, status_code, gross_amount, updated_at)
    VALUES (@order_id, @transaction_status, @status_code, @gross_amount, @updated_at)
    ON CONFLICT(order_id) DO UPDATE SET
      transaction_status = excluded.transaction_status,
      status_code = excluded.status_code,
      gross_amount = excluded.gross_amount,
      updated_at = excluded.updated_at
  `).run(payment);
}

export function getPayment(db: Database.Database, orderId: string): Payment | undefined {
  return db.prepare("SELECT * FROM payments WHERE order_id = ?").get(orderId) as Payment | undefined;
}
