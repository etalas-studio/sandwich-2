import type {
  PaymentRepository,
  Payment,
  CreatePaymentInput,
} from "../../application/ports/payment-repository.js";
import type { Database } from "../../db/connection.js";
import {
  createPayment,
  getPayment,
  expireStalePayments,
} from "../../db/payments.js";

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private db: Database) {}

  async create(input: CreatePaymentInput): Promise<void> {
    await createPayment(this.db, input);
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const p = await getPayment(this.db, orderId);
    if (!p) return null;
    // db/payments.ts Payment.localStatus is `string`; port expects LocalPaymentStatus union.
    return p as unknown as Payment;
  }

  expireStale(): Promise<void> {
    return expireStalePayments(this.db);
  }
}
