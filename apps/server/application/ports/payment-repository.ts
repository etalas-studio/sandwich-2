export type LocalPaymentStatus =
  | "creating_payment"
  | "awaiting_payment"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled"
  | "expired";

export interface Payment {
  orderId: string;
  userId: string | null;
  planSlug: string | null;
  localStatus: LocalPaymentStatus;
  transactionStatus: string;
  statusCode: string;
  grossAmount: string;
  paymentType: string | null;
  fraudStatus: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  providerData: string | null;
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

export interface PaymentRepository {
  create(input: CreatePaymentInput): Promise<void>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  expireStale(): Promise<void>;
}
