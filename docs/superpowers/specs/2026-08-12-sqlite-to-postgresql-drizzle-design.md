# SQLite → PostgreSQL Migration with Drizzle ORM

## Overview

Replace SQLite (`better-sqlite3`) with PostgreSQL via Drizzle ORM. Full rewrite of the database layer: schema definition, queries, migrations, and connection — keeping the same public API surface for all existing route and service consumers.

Target: Railway deployment, PostgreSQL in all environments (no SQLite fallback).

---

## Schema (Drizzle)

All tables defined in a single `apps/server/db/schema.ts` using Drizzle PostgreSQL. This replaces 9 incremental migration files.

### Existing tables (migrated as-is)

| Table | Notes |
|-------|-------|
| `users` | `id TEXT PK`, `username UNIQUE`, `email UNIQUE`, `password_hash`, `created_at` |
| `sessions` | `token TEXT PK`, `user_id FK → users.id`, `created_at`, `expires_at` |
| `instance_settings` | `id SERIAL PK`, `repo_path`, `first_run_completed_at` |
| `tickets` | `key TEXT PK` plus 20+ columns from incremental migrations, add **`type`** (prd/prototype/mom/quotation/specs/workflow/general) |
| `payments` | `order_id TEXT PK`, `transaction_status`, `status_code`, `gross_amount`, `updated_at` |

### New tables

| Table | Purpose | Columns |
|-------|---------|---------|
| `subscriptions` | Track user plan after Midtrans payment | `id SERIAL PK`, `user_id FK → users.id`, `plan_slug TEXT` (starter/pro), `status TEXT` (active/cancelled/expired), `started_at`, `updated_at` |
| `chat_messages` | Per-ticket conversation history | `id SERIAL PK`, `ticket_id FK → tickets.key`, `role TEXT` (user/assistant), `content TEXT`, `stage TEXT` (nullable), `created_at` |
| `usage` | Monthly brief usage per user | `id SERIAL PK`, `user_id FK → users.id`, `year_month TEXT`, `count INTEGER`, UNIQUE(user_id, year_month) |
| `user_preferences` | Key-value user settings | `id SERIAL PK`, `user_id FK → users.id`, `key TEXT`, `value TEXT`, UNIQUE(user_id, key) |

### Dropped

- `credentials` table — unused, removed from schema

---

## Connection & Configuration

Replace `better-sqlite3` with `postgres.js` + Drizzle:

```typescript
// apps/server/db/connection.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function openDb(databaseUrl: string): Database {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}
```

**`.env` changes:**
- Remove: `DB_PATH`
- Add: `DATABASE_URL=postgresql://user:pass@host:5432/sandwich`

**`web-server.ts`:** `openDb(dbPath)` → `openDb(process.env.DATABASE_URL!)`

---

## Migration System

Replace custom migration runner with `drizzle-kit`:

1. `drizzle-kit generate` — reads `schema.ts`, diff against live DB, generates SQL
2. `drizzle-kit migrate` — applies pending migrations (replaces `migrate.ts`)

Files removed:
- `db/migrate.ts`
- `db/migrations/*.ts` (9 files)
- `db/migrations/index.ts`

New:
- `apps/server/drizzle.config.ts` — drizzle-kit config
- `apps/server/db/drizzle/migrations/` — auto-generated SQL

---

## Query Migration Pattern

Every `db.prepare()` call across the codebase replaced with Drizzle query API:

| Pattern | Before (SQLite) | After (Drizzle) |
|---------|-----------------|-----------------|
| Insert | `db.prepare("INSERT …").run(params)` | `db.insert(table).values(data)` |
| Select one | `db.prepare("SELECT … WHERE id = ?").get(id)` | `db.select().from(table).where(eq(table.id, id))` |
| Select all | `db.prepare("SELECT …").all()` | `db.select().from(table)` |
| Update | `db.prepare("UPDATE … SET … WHERE …").run(...)` | `db.update(table).set(data).where(eq(...))` |
| Delete | `db.prepare("DELETE … WHERE …").run(key)` | `db.delete(table).where(eq(...))` |
| Transaction | `db.transaction(() => { … })` | `db.transaction(async (tx) => { … })` |
| Upsert | `ON CONFLICT … DO UPDATE` | `db.insert(table).values(data).onConflictDoUpdate(...)` |

---

## Files Changed

### New
- `apps/server/db/schema.ts`
- `apps/server/db/repo/subscriptions.ts`
- `apps/server/db/repo/chat-messages.ts`
- `apps/server/db/repo/usage.ts`
- `apps/server/db/repo/user-preferences.ts`
- `apps/server/drizzle.config.ts`

### Modified (query rewrite)
- `apps/server/db/connection.ts` — total rewrite
- `apps/server/db/repo/users.ts` — Drizzle API
- `apps/server/db/repo/sessions.ts` — Drizzle API
- `apps/server/db/repo/tickets.ts` — Drizzle API + add `type` column
- `apps/server/db/repo/payments.ts` — Drizzle API
- `apps/server/web-server.ts` — connection params
- `apps/server/auth/middleware.ts` — `Database` type change
- `apps/server/auth/service.ts` — query rewrite
- `apps/server/routes/auth.ts`
- `apps/server/routes/tickets.ts`
- `apps/server/routes/ticket-run.ts`
- `apps/server/routes/midtrans.ts`
- `apps/server/routes/settings.ts`
- `apps/server/routes/purge.ts`
- `.env` — DB_PATH → DATABASE_URL
- `package.json` — dependencies

### Removed
- `apps/server/db/migrate.ts`
- `apps/server/db/migrations/` (9 files + index + types)

---

## Dependencies

```
Remove:
  better-sqlite3
  @types/better-sqlite3

Add:
  drizzle-orm
  drizzle-kit          (dev)
  postgres
  @types/pg            (dev, if needed)
```

---

## Testing

- All existing `*.test.ts` files use in-memory SQLite or test DB. With PostgreSQL, tests need a running PG instance.
- Option: use `pg-mem` for unit tests (in-memory PostgreSQL mock), or require `DATABASE_URL` pointing to a test database.
- Decision: tests that don't need actual DB (unit tests) stay as-is; integration tests require `DATABASE_URL`.
