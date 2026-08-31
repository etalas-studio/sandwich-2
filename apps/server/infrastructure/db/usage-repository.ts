import type { UsageRepository, UsageKind } from "../../application/ports/usage-repository.js";
import type { Database } from "../../db/connection.js";
import { getMonthlyUsage, incrementUsage } from "../../db/repo/usage.js";

export class DrizzleUsageRepository implements UsageRepository {
  constructor(private db: Database) {}

  getMonthly(userId: string, kind: UsageKind): Promise<number> {
    return getMonthlyUsage(this.db, userId, kind);
  }

  increment(userId: string, kind: UsageKind): Promise<number> {
    return incrementUsage(this.db, userId, kind);
  }
}
