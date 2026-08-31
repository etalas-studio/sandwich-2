import type {
  PaymentRepository,
  Payment,
  CreatePaymentInput,
  LocalPaymentStatus,
} from "../../application/ports/payment-repository.js";
import type { Database } from "../../db/connection.js";
import {
  createPayment,
  getPayment,
  expireStalePayments,
} from "../../db/payments.js";

type RawPayment = NonNullable<Awaited<ReturnType<typeof getPayment>>>;

function toPayment(p: RawPayment): Payment {
  return {
    ...p,
    localStatus: p.localStatus as LocalPaymentStatus,
  };
}

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private db: Database) {}

  async create(input: CreatePaymentInput): Promise<void> {
    await createPayment(this.db, input);
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const p = await getPayment(this.db, orderId);
    if (!p) return null;
    return toPayment(p);
  }

  expireStale(): Promise<void> {
    return expireStalePayments(this.db);
  }
}
