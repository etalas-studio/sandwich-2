import { sql, desc, and, eq, gt, lt, isNull, or, inArray } from "drizzle-orm";
import { users, subscriptions, payments, usage, documents } from "../schema.js";
import type { Database } from "../connection.js";

export interface AdminStatsPayment {
  orderId: string;
  userEmail: string | null;
  planSlug: string | null;
  grossAmount: string;
  transactionStatus: string;
  fraudStatus: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeProSubs: number;
  starterUsers: number;
  revenueThisMonth: number;
  usageThisMonth: { doc: number; prototype: number; chat: number };
  recentPayments: AdminStatsPayment[];
  docsByType: { prd: number; quotation: number; prototype: number; specs: number };
  paymentFunnel: { initiated: number; settled: number; failed: number };
  expiringSubsCount: number;
  newUsersThisMonth: number;
  newUsersLastMonth: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  subscription: { planSlug: string; status: string; expiresAt: string | null } | null;
  usageThisMonth: { doc: number; prototype: number; chat: number };
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getAdminStats(db: Database): Promise<AdminStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ym = currentYearMonth();

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(users);
  const totalUsers = totalRow!.count;

  const [proRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planSlug, "pro"),
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
      ),
    );
  const activeProSubs = proRow!.count;

  const [revRow] = await db
    .select({
      total: sql<number>`coalesce(cast(sum(cast(gross_amount as numeric)) as int), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.transactionStatus, "settlement"),
        gt(payments.createdAt, monthStart),
      ),
    );
  const revenueThisMonth = revRow!.total;

  const usageRows = await db
    .select({ kind: usage.kind, total: sql<number>`cast(sum(${usage.count}) as int)` })
    .from(usage)
    .where(eq(usage.yearMonth, ym))
    .groupBy(usage.kind);
  const usageMap: Record<string, number> = {};
  for (const row of usageRows) usageMap[row.kind] = row.total;

  const paymentRows = await db
    .select({
      orderId: payments.orderId,
      userEmail: users.email,
      planSlug: payments.planSlug,
      grossAmount: payments.grossAmount,
      transactionStatus: payments.transactionStatus,
      fraudStatus: payments.fraudStatus,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(users, eq(payments.userId, users.id))
    .orderBy(desc(payments.createdAt))
    .limit(10);

  // Doc breakdown by type (all-time)
  const docTypeRows = await db
    .select({ type: documents.type, count: sql<number>`cast(count(*) as int)` })
    .from(documents)
    .groupBy(documents.type);
  const docMap: Record<string, number> = {};
  for (const r of docTypeRows) docMap[r.type] = r.count;

  // Payment funnel this month
  const funnelRows = await db
    .select({ status: payments.transactionStatus, count: sql<number>`cast(count(*) as int)` })
    .from(payments)
    .where(gt(payments.createdAt, monthStart))
    .groupBy(payments.transactionStatus);
  const funnelMap: Record<string, number> = {};
  for (const r of funnelRows) funnelMap[r.status] = r.count;
  const failedCount =
    (funnelMap["expire"] ?? 0) + (funnelMap["cancel"] ?? 0) + (funnelMap["deny"] ?? 0);

  // Subscriptions expiring within 7 days
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [expiringRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(subscriptions.expiresAt, now),
        lt(subscriptions.expiresAt, sevenDaysOut),
      ),
    );

  // New signups this month vs last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [[newThisRow], [newLastRow]] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(gt(users.createdAt, monthStart)),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(and(gt(users.createdAt, lastMonthStart), lt(users.createdAt, monthStart))),
  ]);

  return {
    totalUsers,
    activeProSubs,
    starterUsers: totalUsers - activeProSubs,
    revenueThisMonth,
    usageThisMonth: {
      doc: usageMap["doc"] ?? 0,
      prototype: usageMap["prototype"] ?? 0,
      chat: usageMap["chat"] ?? 0,
    },
    recentPayments: paymentRows.map((r) => ({
      orderId: r.orderId,
      userEmail: r.userEmail ?? null,
      planSlug: r.planSlug,
      grossAmount: r.grossAmount,
      transactionStatus: r.transactionStatus,
      fraudStatus: r.fraudStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    docsByType: {
      prd: docMap["prd"] ?? 0,
      quotation: docMap["quotation"] ?? 0,
      prototype: docMap["prototype"] ?? 0,
      specs: docMap["specs"] ?? 0,
    },
    paymentFunnel: {
      initiated: funnelMap["pending"] ?? 0,
      settled: funnelMap["settlement"] ?? 0,
      failed: failedCount,
    },
    expiringSubsCount: expiringRow?.count ?? 0,
    newUsersThisMonth: newThisRow?.count ?? 0,
    newUsersLastMonth: newLastRow?.count ?? 0,
  };
}

export async function getAdminUsers(
  db: Database,
  page: number,
  limit: number,
  search?: string,
  role?: string,
): Promise<{ users: AdminUser[]; total: number }> {
  const ym = currentYearMonth();
  const offset = (page - 1) * limit;

  const buildWhere = () => {
    const conds = [];
    if (search) {
      const pattern = `%${search}%`;
      conds.push(
        or(
          sql`${users.email} ilike ${pattern}`,
          sql`${users.username} ilike ${pattern}`,
        ),
      );
    }
    if (role === "admin" || role === "user") {
      conds.push(eq(users.role, role));
    }
    return conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
  };

  const whereClause = buildWhere();

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(users)
    .where(whereClause);
  const total = totalRow!.count;

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      subPlanSlug: subscriptions.planSlug,
      subStatus: subscriptions.status,
      subExpiresAt: subscriptions.expiresAt,
    })
    .from(users)
    .leftJoin(
      subscriptions,
      and(eq(users.id, subscriptions.userId), eq(subscriptions.status, "active")),
    )
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const userIds = userRows.map((r) => r.id);
  const usageByUser: Record<string, { doc: number; prototype: number; chat: number }> = {};
  for (const id of userIds) usageByUser[id] = { doc: 0, prototype: 0, chat: 0 };

  if (userIds.length > 0) {
    const uRows = await db
      .select({ userId: usage.userId, kind: usage.kind, count: usage.count })
      .from(usage)
      .where(and(eq(usage.yearMonth, ym), inArray(usage.userId, userIds)));
    for (const row of uRows) {
      const entry = usageByUser[row.userId];
      if (!entry) continue;
      if (row.kind === "doc") entry.doc = row.count;
      else if (row.kind === "prototype") entry.prototype = row.count;
      else if (row.kind === "chat") entry.chat = row.count;
    }
  }

  return {
    total,
    users: userRows.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
      role: r.role,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt.toISOString(),
      subscription: r.subPlanSlug
        ? {
            planSlug: r.subPlanSlug,
            status: r.subStatus!,
            expiresAt: r.subExpiresAt ? r.subExpiresAt.toISOString() : null,
          }
        : null,
      usageThisMonth: usageByUser[r.id] ?? { doc: 0, prototype: 0, chat: 0 },
    })),
  };
}
