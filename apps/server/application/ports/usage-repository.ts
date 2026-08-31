export type UsageKind = "doc" | "prototype" | "chat";

export interface UsageRepository {
  getMonthly(userId: string, kind: UsageKind): Promise<number>;
  increment(userId: string, kind: UsageKind): Promise<number>;
}
