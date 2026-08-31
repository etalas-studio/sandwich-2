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
  localStatus?: string;
}

export interface PaymentRepository {
  create(input: CreatePaymentInput): Promise<void>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  expireStale(): Promise<void>;
}
