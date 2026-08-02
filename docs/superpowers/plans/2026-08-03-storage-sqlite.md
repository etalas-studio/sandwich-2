# Storage: Embedded SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete embedded-SQLite storage foundation for Phase 1 — schema, migrations, and a typed data-access layer for every entity the product spec describes (tickets, runs, reviews, blocklist entries, readiness scans, credentials, users, sessions, instance settings) — with nothing wired into a CLI, UI, or pipeline stage yet.

**Architecture:** A single `better-sqlite3` connection (`src/db/connection.ts`) opens the file, enables `PRAGMA foreign_keys = ON`, and applies migrations (`src/db/migrate.ts`) defined as an ordered array of embedded-SQL TypeScript modules under `src/db/migrations/` (not raw `.sql` files — this project's build has no asset-copy step, so migration SQL lives in `.ts` modules that `tsc` compiles normally). One repository module per entity under `src/db/` exports typed row interfaces and functions built on prepared statements, each taking the shared `Database` instance as its first argument so it's testable in isolation against a throwaway database file.

**Tech Stack:** TypeScript (matches root `tsconfig.json`), `better-sqlite3` (new runtime dependency) + `@types/better-sqlite3` (new dev dependency, since `better-sqlite3` does not ship its own type declarations).

## Global Constraints

- Root `package.json` gains exactly two new dependencies for this plan: `better-sqlite3` (runtime) and `@types/better-sqlite3` (dev). Confirmed to install and load cleanly on this machine during this plan's planning phase (no native-binary permission issue like `node-pty` hit — see Task 1).
- `tsconfig.json` stays as-is (`strict`, `noUncheckedIndexedAccess`) — do not loosen it.
- Do not modify `src/types.ts` or `src/config.ts` — that `Config` interface belongs to the prior attempt's pipeline (RSpec/lane-rules-specific, validated against the real `config/pipeline.json` fixture `npm run selftest` uses) and is not the foundation this restart extends. `openDb()` takes a file path directly; deciding where that path comes from in a real run is a later piece's job.
- Every module gets its own file, following the pattern already established by `src/engine/` (one class/function per file, a matching `*.test.ts` beside it).
- Timestamps are ISO 8601 strings (`new Date().toISOString()`), generated inside repository functions, never passed in by the caller — matches the schema design doc.
- IDs are generated with `node:crypto`'s `randomUUID()` (no new dependency needed) inside repository insert functions, except for natural keys (`tickets.key`, `credentials.name`) which the caller supplies, and `sessions.token`, which uses `randomBytes(32).toString("hex")` since it's a bearer credential, not just an identifier.
- This plan does not touch worktrees, the readiness-scan process, the pipeline stages, any CLI command, or the web UI — those consume these repository modules later, once they exist.
- Tests use a real temporary SQLite file per test (via `mkdtempSync`/`tmpdir()`), never a mock — SQLite is free and local, so faking it would only test the mock. Follows the hand-rolled test style already used throughout `src/engine/*.test.ts`: plain `node:assert`, `testX(): void` (or `async function` where needed) functions, `console.log("PASS: testX")`, a `main()` that calls them all, run via `node dist/db/<name>.test.js`.

---

### Task 1: Add `better-sqlite3` as a dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `better-sqlite3` available as an import in `src/db/` for Task 2.

- [ ] **Step 1: Install `better-sqlite3` and its type declarations**

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

- [ ] **Step 2: Confirm it installed and typechecks are unaffected**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: no errors (this step only adds dependencies, no code changes yet).

- [ ] **Step 3: Confirm `package.json`/`package-lock.json` show exactly two new dependencies**

```bash
git diff package.json
```

Expected: one line added under `"dependencies"` (`better-sqlite3`) and one line added under `"devDependencies"` (`@types/better-sqlite3`).

- [ ] **Step 4: Confirm the native binary actually loads**

`better-sqlite3` ships a prebuilt native binding, similar to `node-pty` — worth confirming explicitly rather than assuming, the same way the PTY engine toggle plan checked `node-pty`'s `spawn-helper` executable bit. Unlike `node-pty`, this was confirmed during this plan's planning phase to load cleanly out of the box on this machine (no chmod fix needed) — this step is a repeat of that same confirmation, not a known-broken step to fix.

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec('CREATE TABLE t (x INTEGER)');
db.prepare('INSERT INTO t VALUES (1)').run();
console.log(db.prepare('SELECT * FROM t').get());
db.pragma('foreign_keys = ON');
console.log('foreign_keys pragma ok');
"
```

Expected output:
```
{ x: 1 }
foreign_keys pragma ok
```

If this fails instead with a native-binding load error, check `node_modules/better-sqlite3/build/Release/better_sqlite3.node` exists and is readable, and that the Node version matches what the prebuilt binary targets (`node --version`; this project's `engines` field allows Node 20+).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add better-sqlite3 as a dependency for the embedded SQLite storage layer"
```

---

### Task 2: Migration runner, connection, and initial schema

**Files:**
- Create: `src/db/migrations/types.ts`
- Create: `src/db/migrations/0001_init.ts`
- Create: `src/db/migrations/index.ts`
- Create: `src/db/migrate.ts`
- Create: `src/db/connection.ts`
- Test: `src/db/connection.test.ts`

**Interfaces:**
- Consumes: `better-sqlite3` (Task 1).
- Produces: `openDb(path: string): Database.Database` from `src/db/connection.ts` — every repository module in Tasks 3–11 takes a `Database.Database` instance obtained this way as its first argument. `Migration` type from `src/db/migrations/types.ts`.

- [ ] **Step 1: Write `src/db/migrations/types.ts`**

```typescript
export interface Migration {
  version: number;
  name: string;
  sql: string;
}
```

- [ ] **Step 2: Write `src/db/migrations/0001_init.ts` — the full schema**

```typescript
import type { Migration } from "./types.js";

export const migration0001Init: Migration = {
  version: 1,
  name: "init",
  sql: `
CREATE TABLE tickets (
  key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  ticket_key TEXT NOT NULL REFERENCES tickets(key),
  engine TEXT NOT NULL,
  outcome TEXT NOT NULL,
  needs_human_category TEXT,
  needs_human_reason TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  branch TEXT,
  worktree_path TEXT,
  base_commit TEXT,
  pr_url TEXT,
  pr_summary TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_runs_ticket_key ON runs(ticket_key);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
  merge_outcome TEXT NOT NULL,
  edit_effort TEXT NOT NULL,
  review_rounds INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE readiness_scans (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  tech_stack TEXT,
  test_command TEXT,
  area_signals TEXT,
  status TEXT NOT NULL
);

CREATE TABLE blocklist_entries (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  proposed_by_scan_id TEXT REFERENCES readiness_scans(id),
  created_at TEXT NOT NULL
);

CREATE TABLE credentials (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE instance_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  repo_path TEXT,
  first_run_completed_at TEXT
);
INSERT OR IGNORE INTO instance_settings (id) VALUES (1);
`,
};
```

- [ ] **Step 3: Write `src/db/migrations/index.ts`**

```typescript
import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";

export const MIGRATIONS: Migration[] = [migration0001Init];
```

- [ ] **Step 4: Write `src/db/migrate.ts`**

```typescript
import type Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations/index.js";

/**
 * Applies any migration in MIGRATIONS not yet recorded in schema_migrations,
 * in ascending version order, each inside its own transaction. A no-op if
 * every migration is already applied.
 */
export function migrate(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );`,
  );

  const appliedVersions = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
      (row) => row.version,
    ),
  );

  const pending = MIGRATIONS.filter((m) => !appliedVersions.has(m.version)).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        new Date().toISOString(),
      );
    });
    applyMigration();
  }
}
```

- [ ] **Step 5: Write `src/db/connection.ts`**

```typescript
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrate.js";

/**
 * Opens (creating if absent) the SQLite file at `path`, ensures its parent
 * directory exists, enables foreign-key enforcement (off by default in
 * SQLite), and applies any pending migrations before returning.
 */
export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
```

- [ ] **Step 6: Write the failing test `src/db/connection.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";

function testMigratesFreshDatabase(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const db = openDb(join(dir, "db.sqlite"));

  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((row) => row.name);

  for (const expected of [
    "tickets",
    "runs",
    "reviews",
    "readiness_scans",
    "blocklist_entries",
    "credentials",
    "users",
    "sessions",
    "instance_settings",
    "schema_migrations",
  ]) {
    assert.ok(tables.includes(expected), `expected table ${expected} to exist`);
  }
  console.log("PASS: testMigratesFreshDatabase");
}

function testMigratingTwiceIsANoOp(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const dbPath = join(dir, "db.sqlite");
  openDb(dbPath).close();
  const db2 = openDb(dbPath);

  const count = (
    db2.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number }
  ).c;
  assert.equal(count, 1);
  console.log("PASS: testMigratingTwiceIsANoOp");
}

function testInstanceSettingsSeeded(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  const row = db.prepare("SELECT * FROM instance_settings WHERE id = 1").get();
  assert.ok(row);
  console.log("PASS: testInstanceSettingsSeeded");
}

function main(): void {
  testMigratesFreshDatabase();
  testMigratingTwiceIsANoOp();
  testInstanceSettingsSeeded();
}

main();
```

- [ ] **Step 7: Run it to confirm it fails (modules don't exist yet — write this test after Steps 1–5 in practice, but verify it before this step if reordering)**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: passes only once all of Steps 1–5 are in place; if you write the test file first, expect `Cannot find module './connection.js'` until Step 5 lands.

- [ ] **Step 8: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/connection.test.js
```

Expected output:
```
PASS: testMigratesFreshDatabase
PASS: testMigratingTwiceIsANoOp
PASS: testInstanceSettingsSeeded
```

- [ ] **Step 9: Commit**

```bash
git add src/db/migrations/types.ts src/db/migrations/0001_init.ts src/db/migrations/index.ts src/db/migrate.ts src/db/connection.ts src/db/connection.test.ts
git commit -m "Add SQLite migration runner, connection, and initial schema"
```

---

### Task 3: `tickets` repository module

**Files:**
- Create: `src/db/tickets.ts`
- Test: `src/db/tickets.test.ts`

**Interfaces:**
- Consumes: `openDb` from `src/db/connection.ts` (Task 2).
- Produces: `Ticket`, `TicketInput`, `upsertTicket(db, input): Ticket`, `getTicketByKey(db, key): Ticket | null`, `listTickets(db): Ticket[]` — consumed by Task 4's `runs` module tests (to satisfy the `ticket_key` foreign key) and by future Ticket intake / Pipeline pieces, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/tickets.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket, getTicketByKey, listTickets } from "./tickets.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "tickets-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAndReadsBackATicket(): void {
  const db = openTestDb();
  upsertTicket(db, {
    key: "PROJ-1",
    summary: "Fix typo",
    description: "Fix the typo in README",
    url: "https://example.com/PROJ-1",
  });

  const ticket = getTicketByKey(db, "PROJ-1");
  assert.ok(ticket);
  assert.equal(ticket!.summary, "Fix typo");
  assert.equal(ticket!.url, "https://example.com/PROJ-1");
  console.log("PASS: testInsertsAndReadsBackATicket");
}

function testUpsertUpdatesExistingTicketWithoutChangingCreatedAt(): void {
  const db = openTestDb();
  upsertTicket(db, { key: "PROJ-2", summary: "Old summary", description: "Old description" });
  const first = getTicketByKey(db, "PROJ-2")!;

  upsertTicket(db, { key: "PROJ-2", summary: "New summary", description: "New description" });
  const second = getTicketByKey(db, "PROJ-2")!;

  assert.equal(second.summary, "New summary");
  assert.equal(second.description, "New description");
  assert.equal(second.createdAt, first.createdAt);
  console.log("PASS: testUpsertUpdatesExistingTicketWithoutChangingCreatedAt");
}

function testListTicketsReturnsAllTickets(): void {
  const db = openTestDb();
  upsertTicket(db, { key: "PROJ-3", summary: "A", description: "A" });
  upsertTicket(db, { key: "PROJ-4", summary: "B", description: "B" });

  const tickets = listTickets(db);
  assert.equal(tickets.length, 2);
  console.log("PASS: testListTicketsReturnsAllTickets");
}

function testGetTicketByKeyReturnsNullWhenMissing(): void {
  const db = openTestDb();
  assert.equal(getTicketByKey(db, "MISSING"), null);
  console.log("PASS: testGetTicketByKeyReturnsNullWhenMissing");
}

function main(): void {
  testInsertsAndReadsBackATicket();
  testUpsertUpdatesExistingTicketWithoutChangingCreatedAt();
  testListTicketsReturnsAllTickets();
  testGetTicketByKeyReturnsNullWhenMissing();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './tickets.js'`.

- [ ] **Step 3: Write `src/db/tickets.ts`**

```typescript
import type Database from "better-sqlite3";

export interface Ticket {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  key: string;
  summary: string;
  description: string;
  url?: string | null;
}

/**
 * Upserted whenever the ticket queue file is read, so a ticket's details
 * stay attached to its run history even if it's later removed from the
 * queue file. created_at is preserved across updates; updated_at always
 * reflects the latest write.
 */
export function upsertTicket(db: Database.Database, input: TicketInput): Ticket {
  const now = new Date().toISOString();
  const existing = getTicketByKey(db, input.key);
  const createdAt = existing?.createdAt ?? now;

  db.prepare(
    `INSERT INTO tickets (key, summary, description, url, created_at, updated_at)
     VALUES (@key, @summary, @description, @url, @createdAt, @updatedAt)
     ON CONFLICT(key) DO UPDATE SET
       summary = excluded.summary,
       description = excluded.description,
       url = excluded.url,
       updated_at = excluded.updated_at`,
  ).run({
    key: input.key,
    summary: input.summary,
    description: input.description,
    url: input.url ?? null,
    createdAt,
    updatedAt: now,
  });

  return getTicketByKey(db, input.key)!;
}

export function getTicketByKey(db: Database.Database, key: string): Ticket | null {
  const row = db.prepare("SELECT * FROM tickets WHERE key = ?").get(key) as
    | RawTicketRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function listTickets(db: Database.Database): Ticket[] {
  const rows = db.prepare("SELECT * FROM tickets ORDER BY created_at").all() as RawTicketRow[];
  return rows.map(mapRow);
}

interface RawTicketRow {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawTicketRow): Ticket {
  return {
    key: row.key,
    summary: row.summary,
    description: row.description,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/tickets.test.js
```

Expected output:
```
PASS: testInsertsAndReadsBackATicket
PASS: testUpsertUpdatesExistingTicketWithoutChangingCreatedAt
PASS: testListTicketsReturnsAllTickets
PASS: testGetTicketByKeyReturnsNullWhenMissing
```

- [ ] **Step 5: Commit**

```bash
git add src/db/tickets.ts src/db/tickets.test.ts
git commit -m "Add tickets repository module"
```

---

### Task 4: `runs` repository module

**Files:**
- Create: `src/db/runs.ts`
- Test: `src/db/runs.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2), `upsertTicket` (Task 3, used only in the test to satisfy the `ticket_key` foreign key).
- Produces: `Run`, `NewRun`, `RunUpdate`, `insertRun(db, input): Run`, `updateRun(db, id, update): Run`, `getRunById(db, id): Run | null`, `listRunsForTicket(db, ticketKey): Run[]` — consumed by Task 5's `reviews` module tests (to satisfy the `run_id` foreign key) and by the future Pipeline shape piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/runs.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun, updateRun, getRunById, listRunsForTicket } from "./runs.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "runs-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  upsertTicket(db, { key: "PROJ-1", summary: "Fix typo", description: "Fix the typo" });
  return db;
}

function testInsertsAndReadsBackARun(): void {
  const db = openTestDb();
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: new Date().toISOString(),
  });

  const fetched = getRunById(db, run.id);
  assert.ok(fetched);
  assert.equal(fetched!.ticketKey, "PROJ-1");
  assert.equal(fetched!.outcome, "judging");
  assert.equal(fetched!.finishedAt, null);
  console.log("PASS: testInsertsAndReadsBackARun");
}

function testInsertRunFailsForUnknownTicket(): void {
  const db = openTestDb();
  assert.throws(() => {
    insertRun(db, {
      ticketKey: "NOPE",
      engine: "claude-code-headless",
      outcome: "judging",
      startedAt: new Date().toISOString(),
    });
  });
  console.log("PASS: testInsertRunFailsForUnknownTicket");
}

function testUpdateRunMergesFieldsWithoutClearingOthers(): void {
  const db = openTestDb();
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: new Date().toISOString(),
  });

  const updated = updateRun(db, run.id, { outcome: "implementing", branch: "agent/proj-1" });
  assert.equal(updated.outcome, "implementing");
  assert.equal(updated.branch, "agent/proj-1");

  const finalized = updateRun(db, run.id, {
    outcome: "ready_for_review",
    prUrl: "https://example.com/pr/1",
    finishedAt: new Date().toISOString(),
  });
  assert.equal(finalized.outcome, "ready_for_review");
  assert.equal(finalized.branch, "agent/proj-1", "earlier field must survive a later partial update");
  assert.equal(finalized.prUrl, "https://example.com/pr/1");
  assert.ok(finalized.finishedAt);
  console.log("PASS: testUpdateRunMergesFieldsWithoutClearingOthers");
}

function testListRunsForTicketReturnsAllAttemptsInOrder(): void {
  const db = openTestDb();
  const first = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "needs_human",
    startedAt: "2026-08-01T00:00:00.000Z",
  });
  const second = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: "2026-08-02T00:00:00.000Z",
  });

  const runs = listRunsForTicket(db, "PROJ-1");
  assert.equal(runs.length, 2);
  assert.equal(runs[0]!.id, first.id);
  assert.equal(runs[1]!.id, second.id);
  console.log("PASS: testListRunsForTicketReturnsAllAttemptsInOrder");
}

function main(): void {
  testInsertsAndReadsBackARun();
  testInsertRunFailsForUnknownTicket();
  testUpdateRunMergesFieldsWithoutClearingOthers();
  testListRunsForTicketReturnsAllAttemptsInOrder();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './runs.js'`.

- [ ] **Step 3: Write `src/db/runs.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Run {
  id: string;
  ticketKey: string;
  engine: string;
  outcome: string;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  branch: string | null;
  worktreePath: string | null;
  baseCommit: string | null;
  prUrl: string | null;
  prSummary: string | null;
  createdAt: string;
}

export interface NewRun {
  ticketKey: string;
  engine: string;
  /**
   * The exact set of valid outcome strings is finalized by the Pipeline
   * shape piece — this module persists whatever string it's given.
   */
  outcome: string;
  startedAt: string;
}

/** One row per attempt — a ticket can have more than one run over time. */
export function insertRun(db: Database.Database, input: NewRun): Run {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO runs (id, ticket_key, engine, outcome, started_at, created_at)
     VALUES (@id, @ticketKey, @engine, @outcome, @startedAt, @createdAt)`,
  ).run({
    id,
    ticketKey: input.ticketKey,
    engine: input.engine,
    outcome: input.outcome,
    startedAt: input.startedAt,
    createdAt,
  });

  return getRunById(db, id)!;
}

export interface RunUpdate {
  outcome?: string;
  needsHumanCategory?: string | null;
  needsHumanReason?: string | null;
  finishedAt?: string;
  branch?: string;
  worktreePath?: string;
  baseCommit?: string;
  prUrl?: string;
  prSummary?: string;
}

/** Partial update — fields not present in `update` keep their current value. */
export function updateRun(db: Database.Database, id: string, update: RunUpdate): Run {
  const current = getRunById(db, id);
  if (!current) {
    throw new Error(`No run found with id ${id}`);
  }

  const merged = {
    outcome: update.outcome ?? current.outcome,
    needsHumanCategory:
      update.needsHumanCategory !== undefined
        ? update.needsHumanCategory
        : current.needsHumanCategory,
    needsHumanReason:
      update.needsHumanReason !== undefined ? update.needsHumanReason : current.needsHumanReason,
    finishedAt: update.finishedAt ?? current.finishedAt,
    branch: update.branch ?? current.branch,
    worktreePath: update.worktreePath ?? current.worktreePath,
    baseCommit: update.baseCommit ?? current.baseCommit,
    prUrl: update.prUrl ?? current.prUrl,
    prSummary: update.prSummary ?? current.prSummary,
  };

  db.prepare(
    `UPDATE runs SET
       outcome = @outcome,
       needs_human_category = @needsHumanCategory,
       needs_human_reason = @needsHumanReason,
       finished_at = @finishedAt,
       branch = @branch,
       worktree_path = @worktreePath,
       base_commit = @baseCommit,
       pr_url = @prUrl,
       pr_summary = @prSummary
     WHERE id = @id`,
  ).run({ id, ...merged });

  return getRunById(db, id)!;
}

export function getRunById(db: Database.Database, id: string): Run | null {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RawRunRow | undefined;
  return row ? mapRow(row) : null;
}

export function listRunsForTicket(db: Database.Database, ticketKey: string): Run[] {
  const rows = db
    .prepare("SELECT * FROM runs WHERE ticket_key = ? ORDER BY started_at")
    .all(ticketKey) as RawRunRow[];
  return rows.map(mapRow);
}

interface RawRunRow {
  id: string;
  ticket_key: string;
  engine: string;
  outcome: string;
  needs_human_category: string | null;
  needs_human_reason: string | null;
  started_at: string;
  finished_at: string | null;
  branch: string | null;
  worktree_path: string | null;
  base_commit: string | null;
  pr_url: string | null;
  pr_summary: string | null;
  created_at: string;
}

function mapRow(row: RawRunRow): Run {
  return {
    id: row.id,
    ticketKey: row.ticket_key,
    engine: row.engine,
    outcome: row.outcome,
    needsHumanCategory: row.needs_human_category,
    needsHumanReason: row.needs_human_reason,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    branch: row.branch,
    worktreePath: row.worktree_path,
    baseCommit: row.base_commit,
    prUrl: row.pr_url,
    prSummary: row.pr_summary,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/runs.test.js
```

Expected output:
```
PASS: testInsertsAndReadsBackARun
PASS: testInsertRunFailsForUnknownTicket
PASS: testUpdateRunMergesFieldsWithoutClearingOthers
PASS: testListRunsForTicketReturnsAllAttemptsInOrder
```

If `testInsertRunFailsForUnknownTicket` doesn't throw, check that `connection.ts`'s `db.pragma("foreign_keys = ON")` (Task 2) actually ran — SQLite does not enforce foreign keys by default.

- [ ] **Step 5: Commit**

```bash
git add src/db/runs.ts src/db/runs.test.ts
git commit -m "Add runs repository module"
```

---

### Task 5: `reviews` repository module

**Files:**
- Create: `src/db/reviews.ts`
- Test: `src/db/reviews.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2), `upsertTicket` (Task 3), `insertRun` (Task 4) — both used only in the test to satisfy foreign keys.
- Produces: `Review`, `NewReview`, `insertReview(db, input): Review`, `getReviewForRun(db, runId): Review | null` — consumed by the future Visibility piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/reviews.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun } from "./runs.js";
import { insertReview, getReviewForRun } from "./reviews.js";

function openTestDbWithRun() {
  const dir = mkdtempSync(join(tmpdir(), "reviews-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  upsertTicket(db, { key: "PROJ-1", summary: "Fix typo", description: "Fix the typo" });
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "ready_for_review",
    startedAt: new Date().toISOString(),
  });
  return { db, run };
}

function testInsertsAndReadsBackAReview(): void {
  const { db, run } = openTestDbWithRun();
  insertReview(db, {
    runId: run.id,
    mergeOutcome: "merged",
    editEffort: "minor_edits",
    reviewRounds: 2,
    reviewedAt: new Date().toISOString(),
  });

  const review = getReviewForRun(db, run.id);
  assert.ok(review);
  assert.equal(review!.mergeOutcome, "merged");
  assert.equal(review!.reviewRounds, 2);
  console.log("PASS: testInsertsAndReadsBackAReview");
}

function testOnlyOneReviewAllowedPerRun(): void {
  const { db, run } = openTestDbWithRun();
  insertReview(db, {
    runId: run.id,
    mergeOutcome: "merged",
    editEffort: "merged_as_is",
    reviewRounds: 1,
    reviewedAt: new Date().toISOString(),
  });

  assert.throws(() => {
    insertReview(db, {
      runId: run.id,
      mergeOutcome: "not_merged",
      editEffort: "major_edits",
      reviewRounds: 3,
      reviewedAt: new Date().toISOString(),
    });
  });
  console.log("PASS: testOnlyOneReviewAllowedPerRun");
}

function testGetReviewForRunReturnsNullWhenNotReviewedYet(): void {
  const { db, run } = openTestDbWithRun();
  assert.equal(getReviewForRun(db, run.id), null);
  console.log("PASS: testGetReviewForRunReturnsNullWhenNotReviewedYet");
}

function main(): void {
  testInsertsAndReadsBackAReview();
  testOnlyOneReviewAllowedPerRun();
  testGetReviewForRunReturnsNullWhenNotReviewedYet();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './reviews.js'`.

- [ ] **Step 3: Write `src/db/reviews.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Review {
  id: string;
  runId: string;
  mergeOutcome: string;
  editEffort: string;
  reviewRounds: number;
  reviewedAt: string;
}

export interface NewReview {
  runId: string;
  mergeOutcome: string;
  editEffort: string;
  reviewRounds: number;
  reviewedAt: string;
}

/**
 * Split from `runs` because it's filled in later by a human reviewing the
 * PR, independently of the run's own lifecycle. `run_id` is UNIQUE in the
 * schema — phase 1 captures exactly one review per run.
 */
export function insertReview(db: Database.Database, input: NewReview): Review {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO reviews (id, run_id, merge_outcome, edit_effort, review_rounds, reviewed_at)
     VALUES (@id, @runId, @mergeOutcome, @editEffort, @reviewRounds, @reviewedAt)`,
  ).run({ id, ...input });
  return getReviewForRun(db, input.runId)!;
}

export function getReviewForRun(db: Database.Database, runId: string): Review | null {
  const row = db.prepare("SELECT * FROM reviews WHERE run_id = ?").get(runId) as
    | RawReviewRow
    | undefined;
  return row ? mapRow(row) : null;
}

interface RawReviewRow {
  id: string;
  run_id: string;
  merge_outcome: string;
  edit_effort: string;
  review_rounds: number;
  reviewed_at: string;
}

function mapRow(row: RawReviewRow): Review {
  return {
    id: row.id,
    runId: row.run_id,
    mergeOutcome: row.merge_outcome,
    editEffort: row.edit_effort,
    reviewRounds: row.review_rounds,
    reviewedAt: row.reviewed_at,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/reviews.test.js
```

Expected output:
```
PASS: testInsertsAndReadsBackAReview
PASS: testOnlyOneReviewAllowedPerRun
PASS: testGetReviewForRunReturnsNullWhenNotReviewedYet
```

- [ ] **Step 5: Commit**

```bash
git add src/db/reviews.ts src/db/reviews.test.ts
git commit -m "Add reviews repository module"
```

---

### Task 6: `readiness_scans` repository module

**Files:**
- Create: `src/db/readiness-scans.ts`
- Test: `src/db/readiness-scans.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2).
- Produces: `ReadinessScan`, `AreaSignal`, `startReadinessScan(db, startedAt): ReadinessScan`, `completeReadinessScan(db, id, input): ReadinessScan`, `getReadinessScanById(db, id): ReadinessScan | null`, `getLatestReadinessScan(db): ReadinessScan | null` — consumed by Task 7's `blocklist_entries` module tests (to satisfy the optional `proposed_by_scan_id` foreign key) and by the future readiness-scan process, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/readiness-scans.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { startReadinessScan, completeReadinessScan, getReadinessScanById, getLatestReadinessScan } from "./readiness-scans.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "readiness-scans-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testStartsAScanInRunningState(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  assert.equal(scan.status, "running");
  assert.equal(scan.finishedAt, null);
  assert.equal(scan.areaSignals, null);
  console.log("PASS: testStartsAScanInRunningState");
}

function testCompletingAScanRoundTripsAreaSignals(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  const completed = completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "Node/TypeScript",
    testCommand: "npm test",
    areaSignals: [{ pathPrefix: "src/db", testToCodeRatio: 0.8, churnScore: 0.2 }],
    status: "completed",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.techStack, "Node/TypeScript");
  assert.deepEqual(completed.areaSignals, [
    { pathPrefix: "src/db", testToCodeRatio: 0.8, churnScore: 0.2 },
  ]);

  const fetched = getReadinessScanById(db, scan.id);
  assert.deepEqual(fetched, completed);
  console.log("PASS: testCompletingAScanRoundTripsAreaSignals");
}

function testGetLatestReadinessScanReturnsMostRecentlyStarted(): void {
  const db = openTestDb();
  startReadinessScan(db, "2026-08-01T00:00:00.000Z");
  const second = startReadinessScan(db, "2026-08-02T00:00:00.000Z");

  const latest = getLatestReadinessScan(db);
  assert.equal(latest!.id, second.id);
  console.log("PASS: testGetLatestReadinessScanReturnsMostRecentlyStarted");
}

function main(): void {
  testStartsAScanInRunningState();
  testCompletingAScanRoundTripsAreaSignals();
  testGetLatestReadinessScanReturnsMostRecentlyStarted();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './readiness-scans.js'`.

- [ ] **Step 3: Write `src/db/readiness-scans.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type ReadinessScanStatus = "running" | "completed" | "failed";

export interface AreaSignal {
  pathPrefix: string;
  testToCodeRatio: number;
  churnScore: number;
}

export interface ReadinessScan {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  status: ReadinessScanStatus;
}

/**
 * area_signals is stored as a single JSON blob per scan rather than a
 * normalized child table — the product spec doesn't call for querying
 * signal trends across scans, so a table with no relational query against
 * it yet would be normalization nobody uses.
 */
export function startReadinessScan(db: Database.Database, startedAt: string): ReadinessScan {
  const id = randomUUID();
  db.prepare(`INSERT INTO readiness_scans (id, started_at, status) VALUES (?, ?, 'running')`).run(
    id,
    startedAt,
  );
  return getReadinessScanById(db, id)!;
}

export interface CompleteReadinessScanInput {
  finishedAt: string;
  techStack: string;
  testCommand: string;
  areaSignals: AreaSignal[];
  status: "completed" | "failed";
}

export function completeReadinessScan(
  db: Database.Database,
  id: string,
  input: CompleteReadinessScanInput,
): ReadinessScan {
  db.prepare(
    `UPDATE readiness_scans SET
       finished_at = @finishedAt,
       tech_stack = @techStack,
       test_command = @testCommand,
       area_signals = @areaSignals,
       status = @status
     WHERE id = @id`,
  ).run({
    id,
    finishedAt: input.finishedAt,
    techStack: input.techStack,
    testCommand: input.testCommand,
    areaSignals: JSON.stringify(input.areaSignals),
    status: input.status,
  });
  return getReadinessScanById(db, id)!;
}

export function getReadinessScanById(db: Database.Database, id: string): ReadinessScan | null {
  const row = db.prepare("SELECT * FROM readiness_scans WHERE id = ?").get(id) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function getLatestReadinessScan(db: Database.Database): ReadinessScan | null {
  const row = db
    .prepare("SELECT * FROM readiness_scans ORDER BY started_at DESC LIMIT 1")
    .get() as RawRow | undefined;
  return row ? mapRow(row) : null;
}

interface RawRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  tech_stack: string | null;
  test_command: string | null;
  area_signals: string | null;
  status: string;
}

function mapRow(row: RawRow): ReadinessScan {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    techStack: row.tech_stack,
    testCommand: row.test_command,
    areaSignals: row.area_signals ? (JSON.parse(row.area_signals) as AreaSignal[]) : null,
    status: row.status as ReadinessScanStatus,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/readiness-scans.test.js
```

Expected output:
```
PASS: testStartsAScanInRunningState
PASS: testCompletingAScanRoundTripsAreaSignals
PASS: testGetLatestReadinessScanReturnsMostRecentlyStarted
```

- [ ] **Step 5: Commit**

```bash
git add src/db/readiness-scans.ts src/db/readiness-scans.test.ts
git commit -m "Add readiness_scans repository module"
```

---

### Task 7: `blocklist_entries` repository module

**Files:**
- Create: `src/db/blocklist.ts`
- Test: `src/db/blocklist.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2), `startReadinessScan` (Task 6, used only in the test to satisfy the optional `proposed_by_scan_id` foreign key).
- Produces: `BlocklistEntry`, `BlocklistSource`, `NewBlocklistEntry`, `insertBlocklistEntry(db, input): BlocklistEntry`, `listBlocklistEntries(db): BlocklistEntry[]`, `deleteBlocklistEntry(db, id): void` — consumed by the future readiness-scan process and its UI, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/blocklist.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { startReadinessScan } from "./readiness-scans.js";
import { insertBlocklistEntry, listBlocklistEntries, deleteBlocklistEntry } from "./blocklist.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "blocklist-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAHumanAddedEntryWithNoScan(): void {
  const db = openTestDb();
  const entry = insertBlocklistEntry(db, {
    pattern: "never run migrations",
    reason: "human judgment call, not agent-proposed",
    source: "human",
  });

  assert.equal(entry.source, "human");
  assert.equal(entry.proposedByScanId, null);
  console.log("PASS: testInsertsAHumanAddedEntryWithNoScan");
}

function testInsertsAnAgentProposedEntryLinkedToAScan(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  const entry = insertBlocklistEntry(db, {
    pattern: "app/models/payment.rb",
    reason: "touches billing logic",
    source: "agent",
    proposedByScanId: scan.id,
  });

  assert.equal(entry.source, "agent");
  assert.equal(entry.proposedByScanId, scan.id);
  console.log("PASS: testInsertsAnAgentProposedEntryLinkedToAScan");
}

function testListAndDeleteBlocklistEntries(): void {
  const db = openTestDb();
  const first = insertBlocklistEntry(db, { pattern: "a", reason: "a", source: "human" });
  insertBlocklistEntry(db, { pattern: "b", reason: "b", source: "human" });

  assert.equal(listBlocklistEntries(db).length, 2);

  deleteBlocklistEntry(db, first.id);
  const remaining = listBlocklistEntries(db);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.pattern, "b");
  console.log("PASS: testListAndDeleteBlocklistEntries");
}

function main(): void {
  testInsertsAHumanAddedEntryWithNoScan();
  testInsertsAnAgentProposedEntryLinkedToAScan();
  testListAndDeleteBlocklistEntries();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './blocklist.js'`.

- [ ] **Step 3: Write `src/db/blocklist.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type BlocklistSource = "agent" | "human";

export interface BlocklistEntry {
  id: string;
  pattern: string;
  reason: string;
  source: BlocklistSource;
  proposedByScanId: string | null;
  createdAt: string;
}

export interface NewBlocklistEntry {
  pattern: string;
  reason: string;
  source: BlocklistSource;
  proposedByScanId?: string | null;
}

/** Current mutable blocklist state — agent proposes via a scan, human adds/removes. */
export function insertBlocklistEntry(
  db: Database.Database,
  input: NewBlocklistEntry,
): BlocklistEntry {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO blocklist_entries (id, pattern, reason, source, proposed_by_scan_id, created_at)
     VALUES (@id, @pattern, @reason, @source, @proposedByScanId, @createdAt)`,
  ).run({
    id,
    pattern: input.pattern,
    reason: input.reason,
    source: input.source,
    proposedByScanId: input.proposedByScanId ?? null,
    createdAt,
  });
  return getBlocklistEntryById(db, id)!;
}

export function getBlocklistEntryById(db: Database.Database, id: string): BlocklistEntry | null {
  const row = db.prepare("SELECT * FROM blocklist_entries WHERE id = ?").get(id) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function listBlocklistEntries(db: Database.Database): BlocklistEntry[] {
  const rows = db
    .prepare("SELECT * FROM blocklist_entries ORDER BY created_at")
    .all() as RawRow[];
  return rows.map(mapRow);
}

export function deleteBlocklistEntry(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM blocklist_entries WHERE id = ?").run(id);
}

interface RawRow {
  id: string;
  pattern: string;
  reason: string;
  source: string;
  proposed_by_scan_id: string | null;
  created_at: string;
}

function mapRow(row: RawRow): BlocklistEntry {
  return {
    id: row.id,
    pattern: row.pattern,
    reason: row.reason,
    source: row.source as BlocklistSource,
    proposedByScanId: row.proposed_by_scan_id,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/blocklist.test.js
```

Expected output:
```
PASS: testInsertsAHumanAddedEntryWithNoScan
PASS: testInsertsAnAgentProposedEntryLinkedToAScan
PASS: testListAndDeleteBlocklistEntries
```

- [ ] **Step 5: Commit**

```bash
git add src/db/blocklist.ts src/db/blocklist.test.ts
git commit -m "Add blocklist_entries repository module"
```

---

### Task 8: `credentials` repository module

**Files:**
- Create: `src/db/credentials.ts`
- Test: `src/db/credentials.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2).
- Produces: `Credential`, `upsertCredential(db, name, value): Credential`, `getCredential(db, name): Credential | null`, `listCredentialNames(db): string[]` — consumed by the future Credentials UI piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/credentials.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertCredential, getCredential, listCredentialNames } from "./credentials.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "credentials-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAndReadsBackACredential(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");

  const credential = getCredential(db, "STRIPE_API_KEY");
  assert.ok(credential);
  assert.equal(credential!.value, "sk_test_123");
  console.log("PASS: testInsertsAndReadsBackACredential");
}

function testUpsertOverwritesValueButKeepsCreatedAt(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");
  const first = getCredential(db, "STRIPE_API_KEY")!;

  upsertCredential(db, "STRIPE_API_KEY", "sk_test_456");
  const second = getCredential(db, "STRIPE_API_KEY")!;

  assert.equal(second.value, "sk_test_456");
  assert.equal(second.createdAt, first.createdAt);
  console.log("PASS: testUpsertOverwritesValueButKeepsCreatedAt");
}

function testListCredentialNamesReturnsNamesOnly(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");
  upsertCredential(db, "SENDGRID_KEY", "sg_abc");

  const names = listCredentialNames(db);
  assert.deepEqual(names, ["SENDGRID_KEY", "STRIPE_API_KEY"]);
  console.log("PASS: testListCredentialNamesReturnsNamesOnly");
}

function main(): void {
  testInsertsAndReadsBackACredential();
  testUpsertOverwritesValueButKeepsCreatedAt();
  testListCredentialNamesReturnsNamesOnly();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './credentials.js'`.

- [ ] **Step 3: Write `src/db/credentials.ts`**

```typescript
import type Database from "better-sqlite3";

export interface Credential {
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Populated only once a human provides a value through the UI form
 * described in the product spec — the "blocker" state itself is just a
 * run's needs_human_category/needs_human_reason, not a row here.
 */
export function upsertCredential(db: Database.Database, name: string, value: string): Credential {
  const now = new Date().toISOString();
  const existing = getCredential(db, name);
  const createdAt = existing?.createdAt ?? now;

  db.prepare(
    `INSERT INTO credentials (name, value, created_at, updated_at)
     VALUES (@name, @value, @createdAt, @updatedAt)
     ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run({ name, value, createdAt, updatedAt: now });

  return getCredential(db, name)!;
}

export function getCredential(db: Database.Database, name: string): Credential | null {
  const row = db.prepare("SELECT * FROM credentials WHERE name = ?").get(name) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

/** Names only, never values — for listing "known credentials" in a UI without displaying secrets. */
export function listCredentialNames(db: Database.Database): string[] {
  const rows = db.prepare("SELECT name FROM credentials ORDER BY name").all() as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}

interface RawRow {
  name: string;
  value: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawRow): Credential {
  return { name: row.name, value: row.value, createdAt: row.created_at, updatedAt: row.updated_at };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/credentials.test.js
```

Expected output:
```
PASS: testInsertsAndReadsBackACredential
PASS: testUpsertOverwritesValueButKeepsCreatedAt
PASS: testListCredentialNamesReturnsNamesOnly
```

- [ ] **Step 5: Commit**

```bash
git add src/db/credentials.ts src/db/credentials.test.ts
git commit -m "Add credentials repository module"
```

---

### Task 9: `users` repository module

**Files:**
- Create: `src/db/users.ts`
- Test: `src/db/users.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2).
- Produces: `User`, `NewUser`, `createUser(db, input): User`, `getUserById(db, id): User | null`, `getUserByUsername(db, username): User | null` — consumed by Task 10's `sessions` module tests (to satisfy the `user_id` foreign key) and by the future Auth piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/users.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { createUser, getUserById, getUserByUsername } from "./users.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "users-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testCreatesAndReadsBackAUser(): void {
  const db = openTestDb();
  const user = createUser(db, {
    username: "owner",
    email: "owner@example.com",
    passwordHash: "argon2id$fake-hash",
  });

  assert.equal(getUserById(db, user.id)!.username, "owner");
  assert.equal(getUserByUsername(db, "owner")!.id, user.id);
  console.log("PASS: testCreatesAndReadsBackAUser");
}

function testDuplicateUsernameIsRejected(): void {
  const db = openTestDb();
  createUser(db, { username: "owner", email: "owner@example.com", passwordHash: "hash1" });

  assert.throws(() => {
    createUser(db, { username: "owner", email: "someone-else@example.com", passwordHash: "hash2" });
  });
  console.log("PASS: testDuplicateUsernameIsRejected");
}

function testDuplicateEmailIsRejected(): void {
  const db = openTestDb();
  createUser(db, { username: "owner", email: "owner@example.com", passwordHash: "hash1" });

  assert.throws(() => {
    createUser(db, { username: "someone-else", email: "owner@example.com", passwordHash: "hash2" });
  });
  console.log("PASS: testDuplicateEmailIsRejected");
}

function main(): void {
  testCreatesAndReadsBackAUser();
  testDuplicateUsernameIsRejected();
  testDuplicateEmailIsRejected();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './users.js'`.

- [ ] **Step 3: Write `src/db/users.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

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
  /** Hashing is the Auth piece's responsibility — this module stores an opaque string. */
  passwordHash: string;
}

/**
 * Single row in phase 1, enforced by application logic (the Auth piece),
 * not a schema constraint — the same table shape carries into phase 2's
 * multi-account support without a rewrite.
 */
export function createUser(db: Database.Database, input: NewUser): User {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, created_at)
     VALUES (@id, @username, @email, @passwordHash, @createdAt)`,
  ).run({ id, username: input.username, email: input.email, passwordHash: input.passwordHash, createdAt });
  return getUserById(db, id)!;
}

export function getUserById(db: Database.Database, id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as RawRow | undefined;
  return row ? mapRow(row) : null;
}

export function getUserByUsername(db: Database.Database, username: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

interface RawRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

function mapRow(row: RawRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/users.test.js
```

Expected output:
```
PASS: testCreatesAndReadsBackAUser
PASS: testDuplicateUsernameIsRejected
PASS: testDuplicateEmailIsRejected
```

- [ ] **Step 5: Commit**

```bash
git add src/db/users.ts src/db/users.test.ts
git commit -m "Add users repository module"
```

---

### Task 10: `sessions` repository module

**Files:**
- Create: `src/db/sessions.ts`
- Test: `src/db/sessions.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2), `createUser` (Task 9, used only in the test to satisfy the `user_id` foreign key).
- Produces: `Session`, `createSession(db, userId, expiresAt): Session`, `getSessionByToken(db, token): Session | null`, `deleteSession(db, token): void` — consumed by the future Auth piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/sessions.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { createUser } from "./users.js";
import { createSession, getSessionByToken, deleteSession } from "./sessions.js";

function openTestDbWithUser() {
  const dir = mkdtempSync(join(tmpdir(), "sessions-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  const user = createUser(db, {
    username: "owner",
    email: "owner@example.com",
    passwordHash: "argon2id$fake-hash",
  });
  return { db, user };
}

function testCreatesAndReadsBackASession(): void {
  const { db, user } = openTestDbWithUser();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const session = createSession(db, user.id, expiresAt);

  const fetched = getSessionByToken(db, session.token);
  assert.ok(fetched);
  assert.equal(fetched!.userId, user.id);
  assert.equal(fetched!.expiresAt, expiresAt);
  console.log("PASS: testCreatesAndReadsBackASession");
}

function testDeletingASessionRemovesIt(): void {
  const { db, user } = openTestDbWithUser();
  const session = createSession(db, user.id, new Date(Date.now() + 86400000).toISOString());

  deleteSession(db, session.token);
  assert.equal(getSessionByToken(db, session.token), null);
  console.log("PASS: testDeletingASessionRemovesIt");
}

function testCreateSessionFailsForUnknownUser(): void {
  const dir = mkdtempSync(join(tmpdir(), "sessions-test-"));
  const db = openDb(join(dir, "db.sqlite"));

  assert.throws(() => {
    createSession(db, "no-such-user", new Date(Date.now() + 86400000).toISOString());
  });
  console.log("PASS: testCreateSessionFailsForUnknownUser");
}

function main(): void {
  testCreatesAndReadsBackASession();
  testDeletingASessionRemovesIt();
  testCreateSessionFailsForUnknownUser();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './sessions.js'`.

- [ ] **Step 3: Write `src/db/sessions.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/** token is a bearer credential, not just an identifier — generated with randomBytes, not randomUUID. */
export function createSession(db: Database.Database, userId: string, expiresAt: string): Session {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at)
     VALUES (@token, @userId, @createdAt, @expiresAt)`,
  ).run({ token, userId, createdAt, expiresAt });
  return getSessionByToken(db, token)!;
}

export function getSessionByToken(db: Database.Database, token: string): Session | null {
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

interface RawRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

function mapRow(row: RawRow): Session {
  return { token: row.token, userId: row.user_id, createdAt: row.created_at, expiresAt: row.expires_at };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/sessions.test.js
```

Expected output:
```
PASS: testCreatesAndReadsBackASession
PASS: testDeletingASessionRemovesIt
PASS: testCreateSessionFailsForUnknownUser
```

- [ ] **Step 5: Commit**

```bash
git add src/db/sessions.ts src/db/sessions.test.ts
git commit -m "Add sessions repository module"
```

---

### Task 11: `instance_settings` repository module

**Files:**
- Create: `src/db/settings.ts`
- Test: `src/db/settings.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 2) — relies on the singleton row seeded by the `0001_init` migration (Task 2, Step 2).
- Produces: `InstanceSettings`, `getInstanceSettings(db): InstanceSettings`, `completeFirstRun(db, repoPath, completedAt): InstanceSettings` — consumed by the future first-run-setup UI piece, not part of this plan.

- [ ] **Step 1: Write the failing test `src/db/settings.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { getInstanceSettings, completeFirstRun } from "./settings.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "settings-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testFreshInstanceHasNoRepoPathYet(): void {
  const db = openTestDb();
  const settings = getInstanceSettings(db);

  assert.equal(settings.repoPath, null);
  assert.equal(settings.firstRunCompletedAt, null);
  console.log("PASS: testFreshInstanceHasNoRepoPathYet");
}

function testCompleteFirstRunSetsRepoPathAndTimestamp(): void {
  const db = openTestDb();
  const completedAt = new Date().toISOString();
  const settings = completeFirstRun(db, "/Users/example/projects/widgets", completedAt);

  assert.equal(settings.repoPath, "/Users/example/projects/widgets");
  assert.equal(settings.firstRunCompletedAt, completedAt);
  assert.deepEqual(getInstanceSettings(db), settings);
  console.log("PASS: testCompleteFirstRunSetsRepoPathAndTimestamp");
}

function main(): void {
  testFreshInstanceHasNoRepoPathYet();
  testCompleteFirstRunSetsRepoPathAndTimestamp();
}

main();
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './settings.js'`.

- [ ] **Step 3: Write `src/db/settings.ts`**

```typescript
import type Database from "better-sqlite3";

export interface InstanceSettings {
  repoPath: string | null;
  firstRunCompletedAt: string | null;
}

/**
 * Holds the repo path chosen via the first-run UI folder picker (product
 * spec Core Loop step 0) — set once via the UI, not hand-edited in a config
 * file. The singleton row (id = 1) is seeded by the 0001_init migration, so
 * this always finds exactly one row.
 */
export function getInstanceSettings(db: Database.Database): InstanceSettings {
  const row = db
    .prepare("SELECT repo_path, first_run_completed_at FROM instance_settings WHERE id = 1")
    .get() as RawRow;
  return { repoPath: row.repo_path, firstRunCompletedAt: row.first_run_completed_at };
}

export function completeFirstRun(
  db: Database.Database,
  repoPath: string,
  completedAt: string,
): InstanceSettings {
  db.prepare(
    "UPDATE instance_settings SET repo_path = ?, first_run_completed_at = ? WHERE id = 1",
  ).run(repoPath, completedAt);
  return getInstanceSettings(db);
}

interface RawRow {
  repo_path: string | null;
  first_run_completed_at: string | null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/db/settings.test.js
```

Expected output:
```
PASS: testFreshInstanceHasNoRepoPathYet
PASS: testCompleteFirstRunSetsRepoPathAndTimestamp
```

- [ ] **Step 5: Commit**

```bash
git add src/db/settings.ts src/db/settings.test.ts
git commit -m "Add instance_settings repository module"
```

---

### Task 12: Wire up plan and roadmap status, confirm nothing broke

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-08-03-storage-sqlite.md` (this file — check off all task boxes as part of this commit, per CLAUDE.md's working rules)
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing — this task only updates status tracking and runs full verification.

- [ ] **Step 1: Run the full build and existing self-test to confirm nothing regressed**

```bash
npm run build
npm run selftest
```

Expected: both succeed exactly as before this plan started — this plan added new files only, and touched no file the prior attempt's pipeline (`src/*.ts` outside `src/db/`, `src/engine/`) depends on.

- [ ] **Step 2: Run every new test file added by this plan**

```bash
node dist/db/connection.test.js
node dist/db/tickets.test.js
node dist/db/runs.test.js
node dist/db/reviews.test.js
node dist/db/readiness-scans.test.js
node dist/db/blocklist.test.js
node dist/db/credentials.test.js
node dist/db/users.test.js
node dist/db/sessions.test.js
node dist/db/settings.test.js
```

Expected: every line printed is a `PASS: ...` line, no `AssertionError` or uncaught exception.

- [ ] **Step 3: Append CHANGELOG entries for every task in this plan**

Add to `CHANGELOG.md`, following the format already established there (`- YYYY-MM-DD: [plan-name] | @githubusername - what it delivered`):

```
- 2026-08-03: [storage-sqlite] | @potensio - Added better-sqlite3 as a dependency for the embedded SQLite storage layer
- 2026-08-03: [storage-sqlite] | @potensio - Added SQLite migration runner, connection, and initial schema (src/db/connection.ts, src/db/migrate.ts, src/db/migrations/)
- 2026-08-03: [storage-sqlite] | @potensio - Added tickets repository module (src/db/tickets.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added runs repository module (src/db/runs.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added reviews repository module (src/db/reviews.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added readiness_scans repository module (src/db/readiness-scans.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added blocklist_entries repository module (src/db/blocklist.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added credentials repository module (src/db/credentials.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added users repository module (src/db/users.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added sessions repository module (src/db/sessions.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added instance_settings repository module (src/db/settings.ts)
```

- [ ] **Step 4: Check off every task box in this plan file**

Edit `docs/superpowers/plans/2026-08-03-storage-sqlite.md`: change every `- [ ]` step checkbox in Tasks 1–12 to `- [x]`.

- [ ] **Step 5: Flip the Storage checkbox in `docs/roadmap.md`**

In `docs/roadmap.md`, change:

```
- [ ] Storage (embedded SQLite) — no plan yet
```

to:

```
- [x] Storage (embedded SQLite) — `docs/superpowers/plans/2026-08-03-storage-sqlite.md` (done)
```

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md docs/roadmap.md docs/superpowers/plans/2026-08-03-storage-sqlite.md
git commit -m "Mark storage-sqlite plan complete, update CHANGELOG and roadmap"
```

---

## Plan Self-Review Notes

- **Spec coverage**: Every entity in the design doc (`docs/superpowers/specs/2026-08-03-storage-sqlite-design.md`) has a task: `tickets` (Task 3), `runs` (Task 4), `reviews` (Task 5), `readiness_scans` (Task 6), `blocklist_entries` (Task 7), `credentials` (Task 8), `users` (Task 9), `sessions` (Task 10), `instance_settings` (Task 11). Migration approach, connection, and schema are Task 2. The `better-sqlite3` dependency and its native-binary check are Task 1, mirroring the `node-pty` precedent as requested. The design doc's corrected "DB file location & config" section (no `Config`/`config.ts` changes) is reflected in this plan's Global Constraints and Task 2 (`openDb` takes a raw path).
- **Placeholder scan**: No "TBD"/"TODO" — every step has complete, real code. The `outcome` column's exact enum values are explicitly deferred to the Pipeline shape piece both in the design doc and in Task 4's `NewRun.outcome` doc comment — this is a documented, intentional scope boundary, not an unfinished placeholder.
- **Type consistency**: `Database.Database` (from `better-sqlite3`, Task 1) is the first parameter of every repository function across Tasks 3–11, matching `openDb`'s return type (Task 2). `Ticket.key` (Task 3) matches `Run.ticketKey`'s foreign-key target used in Task 4. `Run.id` (Task 4) matches `Review.runId`'s foreign-key target used in Task 5. `ReadinessScan.id` (Task 6) matches `BlocklistEntry.proposedByScanId`'s foreign-key target used in Task 7. `User.id` (Task 9) matches `Session.userId`'s foreign-key target used in Task 10. Field naming is consistently camelCase in TypeScript interfaces and snake_case in raw SQL/row types across every module, with a `mapRow` function bridging the two in each file, following the same pattern in all nine repository modules.
