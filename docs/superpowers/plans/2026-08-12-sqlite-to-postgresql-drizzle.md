# SQLite → PostgreSQL with Drizzle ORM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all database operations from SQLite (`better-sqlite3`) to PostgreSQL via Drizzle ORM, add 4 new tables for subscription/chat/usage/preferences, and add `type` column to tickets.

**Architecture:** Single `schema.ts` defines all tables using Drizzle PostgreSQL. All existing `db/repo/*.ts` modules rewritten to Drizzle query API. Custom migration system replaced with `drizzle-kit`. New repo modules for the 4 new tables. `Database` type flows from connection.ts to all consumers.

**Tech Stack:** Drizzle ORM, postgres.js, drizzle-kit (dev), PostgreSQL

## Global Constraints

- PostgreSQL in all environments (no SQLite fallback)
- `DATABASE_URL` env var replaces `DB_PATH`
- Remove `better-sqlite3` and `@types/better-sqlite3` from dependencies
- Add `drizzle-orm`, `drizzle-kit` (dev), `postgres`
- All existing route tests must pass with the new DB layer
- `Database` type: `ReturnType<typeof drizzle<typeof schema>>` exported from `connection.ts`

---

### Task 1: Install Dependencies & Setup Drizzle Config

**Files:**
- Modify: `apps/server/package.json` (if separate) or root `package.json`
- Create: `apps/server/drizzle.config.ts`

**Interfaces:**
- Produces: `drizzle.config.ts` pointing to `apps/server/db/schema.ts` and `apps/server/db/drizzle/`

- [ ] **Step 1: Add dependencies**

```bash
cd apps/server && npm install drizzle-orm postgres
npm install -D drizzle-kit
```

If `apps/server` has no separate `package.json`, install at root:
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

- [ ] **Step 2: Remove old dependencies**

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 3: Create drizzle.config.ts**

Write `apps/server/drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./apps/server/db/schema.ts",
  out: "./apps/server/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Verify config parses**

```bash
npx drizzle-kit check --config apps/server/drizzle.config.ts
```

Expected: validates without errors (may need DATABASE_URL set).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json apps/server/drizzle.config.ts
git commit -m "chore: add Drizzle ORM, postgres.js, drizzle-kit; remove better-sqlite3"
```

---

### Task 2: Write Drizzle Schema

**Files:**
- Create: `apps/server/db/schema.ts`
- Remove: `apps/server/db/migrations/types.ts`
- Remove: `apps/server/db/migrations/index.ts`
- Remove: `apps/server/db/migrations/0001_init.ts` through `0016_pr_columns.ts`

**Interfaces:**
- Produces: All table definitions + relations exported from `schema.ts`

- [ ] **Step 1: Write schema.ts with all existing tables**

Write `apps/server/db/schema.ts`:
```typescript
import { pgTable, text, serial, integer, real, uniqueIndex, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => ({
  userIdIdx: index("idx_sessions_user_id").on(table.userId),
}));

export const instanceSettings = pgTable("instance_settings", {
  id: serial("id").primaryKey(),
  repoPath: text("repo_path"),
  firstRunCompletedAt: text("first_run_completed_at"),
});

export const tickets = pgTable("tickets", {
  key: text("key").primaryKey(),
  type: text("type"), // NEW
  summary: text("summary"),
  description: text("description").notNull(),
  url: text("url"),
  status: text("status").notNull().default("backlog"),
  stage: text("stage"),
  needsHumanCategory: text("needs_human_category"),
  needsHumanReason: text("needs_human_reason"),
  prUrl: text("pr_url"),
  prSummary: text("pr_summary"),
  prTitle: text("pr_title"),
  prDescription: text("pr_description"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  worktreePath: text("worktree_path"),
  branchName: text("branch_name"),
  quickWinChoices: text("quick_win_choices"),
  quickWinAttempts: integer("quick_win_attempts").notNull().default(0),
  issueType: text("issue_type"),
  priority: text("priority"),
  sprint: text("sprint"),
  storyPoints: real("story_points"),
  team: text("team"),
  assignee: text("assignee"),
  parentKey: text("parent_key"),
  attachments: text("attachments"),
  jiraStatus: text("jira_status"),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payments = pgTable("payments", {
  orderId: text("order_id").primaryKey(),
  transactionStatus: text("transaction_status").notNull(),
  statusCode: text("status_code").notNull(),
  grossAmount: text("gross_amount").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── NEW TABLES ──

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  planSlug: text("plan_slug").notNull(),
  status: text("status").notNull().default("active"),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => tickets.key),
  role: text("role").notNull(),
  content: text("content").notNull(),
  stage: text("stage"),
  createdAt: text("created_at").notNull(),
});

export const usage = pgTable("usage", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  yearMonth: text("year_month").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({
  uniqueUserMonth: uniqueIndex("idx_usage_user_month").on(table.userId, table.yearMonth),
}));

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => ({
  uniqueUserKey: uniqueIndex("idx_user_prefs_user_key").on(table.userId, table.key),
}));
```

- [ ] **Step 2: Typecheck schema**

```bash
npx tsc --noEmit apps/server/db/schema.ts
```

- [ ] **Step 3: Remove old migration files**

```bash
rm apps/server/db/migrations/types.ts
rm apps/server/db/migrations/index.ts
rm apps/server/db/migrations/0001_init.ts
rm apps/server/db/migrations/0003_tickets.ts
rm apps/server/db/migrations/0004_ticket_worktree.ts
rm apps/server/db/migrations/0007_jira_fields.ts
rm apps/server/db/migrations/0010_ticket_branch.ts
rm apps/server/db/migrations/0011_jira_status.ts
rm apps/server/db/migrations/0014_payments.ts
rm apps/server/db/migrations/0015_ticket_feedback.ts
rm apps/server/db/migrations/0016_pr_columns.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/db/schema.ts
git rm apps/server/db/migrations/*
git commit -m "feat: define full PostgreSQL schema with Drizzle"
```

---

### Task 3: Rewrite Connection Module

**Files:**
- Modify: `apps/server/db/connection.ts`
- Modify: `apps/server/db/connection.test.ts`
- Remove: `apps/server/db/migrate.ts`

**Interfaces:**
- Produces: `openDb(databaseUrl: string): Database` where `Database = ReturnType<typeof drizzle<typeof schema>>`
- Consumes: `schema` from `./schema.js`

- [ ] **Step 1: Rewrite connection.ts**

Write `apps/server/db/connection.ts`:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Re-export the Database type so consumers don't need to import drizzle
export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Opens a PostgreSQL connection using DATABASE_URL.
 * Returns a Drizzle instance with the full schema.
 */
export function openDb(databaseUrl: string): Database {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}
```

- [ ] **Step 2: Remove migrate.ts**

```bash
rm apps/server/db/migrate.ts
```

- [ ] **Step 3: Update connection.test.ts**

Write test that verifies `openDb` returns a Drizzle instance:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { openDb } from "./connection.js";

describe("openDb", () => {
  it("returns a drizzle instance with schema", () => {
    const dbUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5432/test";
    const db = openDb(dbUrl);
    assert.ok(db, "should return a db instance");
    assert.ok(typeof db.select === "function", "should have select");
    assert.ok(typeof db.insert === "function", "should have insert");
  });
});
```

- [ ] **Step 4: Run test**

```bash
node --test dist/apps/server/db/connection.test.js
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/db/connection.ts apps/server/db/connection.test.ts
git rm apps/server/db/migrate.ts
git commit -m "feat: rewrite connection module for PostgreSQL via Drizzle"
```

---

### Task 4: Rewrite users.ts & sessions.ts repos

**Files:**
- Modify: `apps/server/db/users.ts`
- Modify: `apps/server/db/users.test.ts`
- Modify: `apps/server/db/sessions.ts`
- Modify: `apps/server/db/sessions.test.ts`

**Interfaces:**
- Consumes: `Database` from `./connection.js`, schema tables from `./schema.js`
- Produces: Same public function signatures: `createUser`, `getUserById`, `getUserByUsername`, `updatePassword`, `createSession`, `getSessionByToken`, `deleteSession`

- [ ] **Step 1: Rewrite users.ts**

Write `apps/server/db/users.ts`:
```typescript
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { users } from "./schema.js";
import type { Database } from "./connection.js";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
}

export function createUser(db: Database, input: NewUser): User {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.insert(users).values({
    id,
    username: input.username,
    email: input.email,
    passwordHash: input.passwordHash,
    createdAt,
  }).run();
  return getUserById(db, id)!;
}

export function getUserById(db: Database, id: string): User | null {
  const rows = db.select().from(users).where(eq(users.id, id)).limit(1).all();
  if (rows.length === 0) return null;
  return mapUser(rows[0]);
}

export function getUserByUsername(db: Database, username: string): User | null {
  const rows = db.select().from(users).where(eq(users.username, username)).limit(1).all();
  if (rows.length === 0) return null;
  return mapUser(rows[0]);
}

export function updatePassword(db: Database, userId: string, newPasswordHash: string): void {
  const result = db.update(users)
    .set({ passwordHash: newPasswordHash })
    .where(eq(users.id, userId))
    .run();
  if (result.changes === 0) throw new Error("user not found");
}

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}
```

- [ ] **Step 2: Rewrite sessions.ts**

Write `apps/server/db/sessions.ts`:
```typescript
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { sessions } from "./schema.js";
import type { Database } from "./connection.js";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export function createSession(db: Database, userId: string, expiresAt: string): Session {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  db.insert(sessions).values({ token, userId, createdAt, expiresAt }).run();
  return getSessionByToken(db, token)!;
}

export function getSessionByToken(db: Database, token: string): Session | null {
  const rows = db.select().from(sessions).where(eq(sessions.token, token)).limit(1).all();
  if (rows.length === 0) return null;
  return mapSession(rows[0]);
}

export function deleteSession(db: Database, token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

function mapSession(row: typeof sessions.$inferSelect): Session {
  return {
    token: row.token,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
```

- [ ] **Step 3: Remove old test imports**

Both test files import `Database` from `better-sqlite3`. Update imports to use `Database` from `./connection.js` and use Drizzle-compatible test setup.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/db/users.ts apps/server/db/users.test.ts apps/server/db/sessions.ts apps/server/db/sessions.test.ts
git commit -m "feat: rewrite users and sessions repos for Drizzle"
```

---

### Task 5: Rewrite tickets.ts & payments.ts repos

**Files:**
- Modify: `apps/server/db/tickets.ts`
- Modify: `apps/server/db/payments.ts`

**Interfaces:**
- Consumes: `Database` from `./connection.js`, `eq` from drizzle-orm
- Produces: Same public signatures — `createTicket`, `getTicket`, `listTickets`, `updateTicket`, `deleteTicket`, `upsertPayment`, `getPayment`

- [ ] **Step 1: Rewrite tickets.ts**

Key changes:
- Replace `db.prepare().run/get/all` with Drizzle `db.insert/select/update/delete`
- `normaliseTicket` maps from `typeof tickets.$inferSelect` instead of `Record<string, unknown>`
- `updateTicket` uses individual `.set()` calls per field — same logic, different API
- `listTickets` uses `.orderBy(desc(tickets.createdAt))`

```typescript
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { tickets } from "./schema.js";
import type { Database } from "./connection.js";

export interface Ticket {
  key: string;
  type: string | null;
  summary: string | null;
  description: string;
  url: string | null;
  status: string;
  stage: string | null;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  prUrl: string | null;
  prSummary: string | null;
  prTitle: string | null;
  prDescription: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  worktreePath: string | null;
  branchName: string | null;
  quickWinChoices: string | null;
  quickWinAttempts: number;
  issueType: string | null;
  priority: string | null;
  sprint: string | null;
  storyPoints: number | null;
  team: string | null;
  assignee: string | null;
  parentKey: string | null;
  attachments: string | null;
  jiraStatus: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  id: string;
  summary?: string;
  description: string;
  url: string | null;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
}

function normaliseTicket(row: typeof tickets.$inferSelect): Ticket {
  return {
    key: row.key,
    type: row.type,
    summary: row.summary,
    description: row.description,
    url: row.url,
    status: row.status,
    stage: row.stage,
    needsHumanCategory: row.needsHumanCategory,
    needsHumanReason: row.needsHumanReason,
    prUrl: row.prUrl,
    prSummary: row.prSummary,
    prTitle: row.prTitle,
    prDescription: row.prDescription,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    worktreePath: row.worktreePath,
    branchName: row.branchName,
    quickWinChoices: row.quickWinChoices,
    quickWinAttempts: row.quickWinAttempts ?? 0,
    issueType: row.issueType,
    priority: row.priority,
    sprint: row.sprint,
    storyPoints: row.storyPoints,
    team: row.team,
    assignee: row.assignee,
    parentKey: row.parentKey,
    attachments: row.attachments,
    jiraStatus: row.jiraStatus,
    feedback: row.feedback,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createTicket(db: Database, input: CreateTicketInput): Ticket {
  if (!input.description.trim()) throw new Error("description must not be empty");
  const key = input.id.trim() || `T-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.insert(tickets).values({
    key,
    summary: input.summary ?? null,
    description: input.description,
    url: input.url,
    status: "backlog",
    createdAt: now,
    updatedAt: now,
    issueType: input.issueType ?? null,
    priority: input.priority ?? null,
    sprint: input.sprint ?? null,
    storyPoints: input.storyPoints ?? null,
    team: input.team ?? null,
    assignee: input.assignee ?? null,
    parentKey: input.parentKey ?? null,
    attachments: input.attachments ?? null,
  }).run();
  return getTicket(db, key)!;
}

export function listTickets(db: Database): Ticket[] {
  const rows = db.select().from(tickets).orderBy(desc(tickets.createdAt)).all();
  return rows.map(normaliseTicket);
}

export function getTicket(db: Database, key: string): Ticket | null {
  const rows = db.select().from(tickets).where(eq(tickets.key, key)).limit(1).all();
  if (rows.length === 0) return null;
  return normaliseTicket(rows[0]);
}

export interface UpdateTicketInput {
  description?: string;
  summary?: string | null;
  url?: string | null;
  status?: string;
  stage?: string | null;
  worktreePath?: string | null;
  branchName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  prUrl?: string | null;
  prSummary?: string | null;
  prTitle?: string | null;
  prDescription?: string | null;
  needsHumanCategory?: string | null;
  needsHumanReason?: string | null;
  quickWinChoices?: string | null;
  quickWinAttempts?: number;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
  feedback?: string | null;
  type?: string | null;
}

export function updateTicket(db: Database, key: string, input: UpdateTicketInput): Ticket | null {
  const existing = db.select({ key: tickets.key }).from(tickets).where(eq(tickets.key, key)).limit(1).all();
  if (existing.length === 0) return null;

  const now = new Date().toISOString();
  const sets: Record<string, unknown> = { updatedAt: now };

  if (input.description !== undefined) sets.description = input.description;
  if (input.summary !== undefined) sets.summary = input.summary;
  if (input.url !== undefined) sets.url = input.url;
  if (input.status !== undefined) sets.status = input.status;
  if (input.stage !== undefined) sets.stage = input.stage;
  if (input.worktreePath !== undefined) sets.worktreePath = input.worktreePath;
  if (input.branchName !== undefined) sets.branchName = input.branchName;
  if (input.startedAt !== undefined) sets.startedAt = input.startedAt;
  if (input.finishedAt !== undefined) sets.finishedAt = input.finishedAt;
  if (input.prUrl !== undefined) sets.prUrl = input.prUrl;
  if (input.prSummary !== undefined) sets.prSummary = input.prSummary;
  if (input.prTitle !== undefined) sets.prTitle = input.prTitle;
  if (input.prDescription !== undefined) sets.prDescription = input.prDescription;
  if (input.needsHumanCategory !== undefined) sets.needsHumanCategory = input.needsHumanCategory;
  if (input.needsHumanReason !== undefined) sets.needsHumanReason = input.needsHumanReason;
  if (input.quickWinChoices !== undefined) sets.quickWinChoices = input.quickWinChoices;
  if (input.quickWinAttempts !== undefined) sets.quickWinAttempts = input.quickWinAttempts;
  if (input.issueType !== undefined) sets.issueType = input.issueType;
  if (input.priority !== undefined) sets.priority = input.priority;
  if (input.sprint !== undefined) sets.sprint = input.sprint;
  if (input.storyPoints !== undefined) sets.storyPoints = input.storyPoints;
  if (input.team !== undefined) sets.team = input.team;
  if (input.assignee !== undefined) sets.assignee = input.assignee;
  if (input.parentKey !== undefined) sets.parentKey = input.parentKey;
  if (input.attachments !== undefined) sets.attachments = input.attachments;
  if (input.feedback !== undefined) sets.feedback = input.feedback;
  if (input.type !== undefined) sets.type = input.type;

  db.update(tickets).set(sets).where(eq(tickets.key, key)).run();
  return getTicket(db, key);
}

export function deleteTicket(db: Database, key: string): boolean {
  const result = db.delete(tickets).where(eq(tickets.key, key)).run();
  return result.changes > 0;
}
```

- [ ] **Step 2: Rewrite payments.ts**

```typescript
import { eq } from "drizzle-orm";
import { payments } from "./schema.js";
import type { Database } from "./connection.js";

export interface Payment {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  updated_at: string;
}

export function upsertPayment(db: Database, payment: Payment): void {
  db.insert(payments).values({
    orderId: payment.order_id,
    transactionStatus: payment.transaction_status,
    statusCode: payment.status_code,
    grossAmount: payment.gross_amount,
    updatedAt: payment.updated_at,
  }).onConflictDoUpdate({
    target: payments.orderId,
    set: {
      transactionStatus: payment.transaction_status,
      statusCode: payment.status_code,
      grossAmount: payment.gross_amount,
      updatedAt: payment.updated_at,
    },
  }).run();
}

export function getPayment(db: Database, orderId: string): Payment | undefined {
  const rows = db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1).all();
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    order_id: r.orderId,
    transaction_status: r.transactionStatus,
    status_code: r.statusCode,
    gross_amount: r.grossAmount,
    updated_at: r.updatedAt,
  };
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/db/tickets.ts apps/server/db/payments.ts
git commit -m "feat: rewrite tickets and payments repos for Drizzle"
```

---

### Task 6: Create New Repo Modules

**Files:**
- Create: `apps/server/db/repo/subscriptions.ts`
- Create: `apps/server/db/repo/chat-messages.ts`
- Create: `apps/server/db/repo/usage.ts`
- Create: `apps/server/db/repo/user-preferences.ts`

**Interfaces:**
- Produces: CRUD functions for each new table

- [ ] **Step 1: Write subscriptions.ts**

```typescript
import { eq, and } from "drizzle-orm";
import { subscriptions } from "../schema.js";
import type { Database } from "../connection.js";

export interface Subscription {
  id: number;
  userId: string;
  planSlug: string;
  status: string;
  startedAt: string;
  updatedAt: string;
}

export function createSubscription(
  db: Database,
  input: { userId: string; planSlug: string },
): Subscription {
  const now = new Date().toISOString();
  db.insert(subscriptions).values({
    userId: input.userId,
    planSlug: input.planSlug,
    status: "active",
    startedAt: now,
    updatedAt: now,
  }).run();
  const rows = db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.status, "active")))
    .orderBy(subscriptions.id)
    .limit(1).all();
  return rows[0]!;
}

export function getActiveSubscription(db: Database, userId: string): Subscription | null {
  const rows = db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1).all();
  return rows.length > 0 ? rows[0] : null;
}

export function cancelSubscription(db: Database, userId: string): void {
  const now = new Date().toISOString();
  db.update(subscriptions)
    .set({ status: "cancelled", updatedAt: now })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .run();
}
```

- [ ] **Step 2: Write chat-messages.ts**

```typescript
import { eq, asc } from "drizzle-orm";
import { chatMessages } from "../schema.js";
import type { Database } from "../connection.js";

export interface ChatMessage {
  id: number;
  ticketId: string;
  role: string;
  content: string;
  stage: string | null;
  createdAt: string;
}

export function addChatMessage(
  db: Database,
  input: { ticketId: string; role: string; content: string; stage?: string | null },
): ChatMessage {
  const now = new Date().toISOString();
  db.insert(chatMessages).values({
    ticketId: input.ticketId,
    role: input.role,
    content: input.content,
    stage: input.stage ?? null,
    createdAt: now,
  }).run();
  const rows = db.select().from(chatMessages)
    .where(eq(chatMessages.ticketId, input.ticketId))
    .orderBy(asc(chatMessages.createdAt))
    .all();
  return rows[rows.length - 1]!;
}

export function getChatMessages(db: Database, ticketId: string): ChatMessage[] {
  return db.select().from(chatMessages)
    .where(eq(chatMessages.ticketId, ticketId))
    .orderBy(asc(chatMessages.createdAt))
    .all();
}
```

- [ ] **Step 3: Write usage.ts**

```typescript
import { eq, and } from "drizzle-orm";
import { usage } from "../schema.js";
import type { Database } from "../connection.js";

export function incrementUsage(db: Database, userId: string): number {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${now.getMonth()}`;

  const existing = db.select().from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.yearMonth, yearMonth)))
    .limit(1).all();

  if (existing.length > 0) {
    const newCount = existing[0].count + 1;
    db.update(usage)
      .set({ count: newCount })
      .where(eq(usage.id, existing[0].id))
      .run();
    return newCount;
  }

  db.insert(usage).values({ userId, yearMonth, count: 1 }).run();
  return 1;
}

export function getMonthlyUsage(db: Database, userId: string): number {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const rows = db.select().from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.yearMonth, yearMonth)))
    .limit(1).all();
  return rows.length > 0 ? rows[0].count : 0;
}
```

- [ ] **Step 4: Write user-preferences.ts**

```typescript
import { eq, and } from "drizzle-orm";
import { userPreferences } from "../schema.js";
import type { Database } from "../connection.js";

export function setPreference(db: Database, userId: string, key: string, value: string): void {
  db.insert(userPreferences).values({ userId, key, value })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.key],
      set: { value },
    }).run();
}

export function getPreference(db: Database, userId: string, key: string): string | null {
  const rows = db.select().from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
    .limit(1).all();
  return rows.length > 0 ? rows[0].value : null;
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/db/repo/
git commit -m "feat: add subscriptions, chat-messages, usage, user-preferences repos"
```

---

### Task 7: Update Consumers (Auth, Web Server, Routes)

**Files:**
- Modify: `apps/server/web-server.ts`
- Modify: `apps/server/auth/middleware.ts`
- Modify: `apps/server/auth/service.ts`
- Modify: `apps/server/routes/auth.ts`
- Modify: `apps/server/routes/tickets.ts`
- Modify: `apps/server/routes/ticket-run.ts`
- Modify: `apps/server/routes/midtrans.ts`
- Modify: `apps/server/routes/settings.ts`
- Modify: `apps/server/routes/purge.ts`
- Modify: `.env`

**Interfaces:**
- Consumes: `Database` from `./connection.js` (replaces `better-sqlite3.Database`)
- Change: `openDb(dbPath)` → `openDb(databaseUrl)`

- [ ] **Step 1: Update all imports**

In every file that imports `Database` from `better-sqlite3`, replace with:
```typescript
import type { Database } from "../db/connection.js";
```

- [ ] **Step 2: Update web-server.ts**

Change `openDb(dbPath)` to `openDb(process.env.DATABASE_URL!)`:
```typescript
const db = openDb(process.env.DATABASE_URL!);
```

Remove `dbPath` from `WebServerOptions`.

- [ ] **Step 3: Update purge.ts**

Replace raw SQL deletes with Drizzle:
```typescript
import { tickets, payments, chatMessages, sessions, users, subscriptions, usage, userPreferences, instanceSettings } from "../db/schema.js";

export function registerPurgeRoute(router: Router, db: Database): void {
  router.post("/api/purge", (req, res) => {
    db.transaction((tx) => {
      tx.delete(chatMessages).run();
      tx.delete(usage).run();
      tx.delete(userPreferences).run();
      tx.delete(payments).run();
      tx.delete(subscriptions).run();
      tx.delete(tickets).run();
      tx.delete(sessions).run();
      tx.delete(users).run();
      tx.delete(instanceSettings).run();
      tx.insert(instanceSettings).values({}).run();
    });
    sendJson(res, 200, { purged: true });
  });
}
```

- [ ] **Step 4: Update .env**

```bash
# Remove DB_PATH, add DATABASE_URL
DATABASE_URL=postgresql://user:pass@localhost:5432/sandwich
```

- [ ] **Step 5: Typecheck full project**

```bash
npx tsc --noEmit
```

Fix any type errors from the migration.

- [ ] **Step 6: Commit**

```bash
git add apps/server/
git commit -m "feat: update all consumers to use Drizzle Database type"
```

---

### Task 8: Generate Migration & Test

**Files:**
- Create: `apps/server/db/drizzle/` (auto-generated)

- [ ] **Step 1: Generate migration SQL**

```bash
npx drizzle-kit generate --config apps/server/drizzle.config.ts
```

This reads schema.ts, diffs against a fresh PostgreSQL DB, and generates initial migration SQL in `apps/server/db/drizzle/`.

- [ ] **Step 2: Start PostgreSQL, apply migration**

```bash
npx drizzle-kit migrate --config apps/server/drizzle.config.ts
```

- [ ] **Step 3: Start server and smoke test**

```bash
npm run serve
```

Test endpoints:
```bash
curl http://localhost:4319/api/auth/me
curl -X POST http://localhost:4319/api/auth/register -H "content-type: application/json" -d '{"username":"test","email":"t@t.com","password":"password123"}'
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/db/drizzle/
git commit -m "feat: generate initial PostgreSQL migration"
```
