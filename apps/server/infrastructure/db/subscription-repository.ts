import type { SubscriptionRepository, Subscription } from "../../application/ports/subscription-repository.js";
import type { Database } from "../../db/connection.js";
import {
  getSubscriptionForUser,
  getActiveSubscription,
  activateSubscription,
  cancelSubscription,
} from "../../db/repo/subscriptions.js";

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private db: Database) {}

  async findByUserId(userId: string): Promise<Subscription | null> {
    return getSubscriptionForUser(this.db, userId);
  }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    return getActiveSubscription(this.db, userId);
  }

  async activate(input: { userId: string; planSlug: string }): Promise<Subscription> {
    return activateSubscription(this.db, input);
  }

  async cancel(userId: string): Promise<void> {
    await cancelSubscription(this.db, userId);
  }
}
