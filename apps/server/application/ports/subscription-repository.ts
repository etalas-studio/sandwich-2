export interface Subscription {
  id: string;
  userId: string;
  planSlug: string;
  status: string;
  periodDays: number;
  expiresAt: Date | null;
  startedAt: Date;
  updatedAt: Date;
}

export interface SubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>;
  findActiveByUserId(userId: string): Promise<Subscription | null>;
  activate(input: { userId: string; planSlug: string }): Promise<Subscription>;
  cancel(userId: string): Promise<void>;
}
