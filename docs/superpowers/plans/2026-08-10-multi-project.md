# Multi-Project & Multi-User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-project support (~5 repos, switching model) and flat multi-user auth (admin creates accounts, everyone sees everything) to the existing single-tenant/single-project architecture.

**Architecture:** Nest all project-aware routes under `/api/projects/:projectId`. Add `project_id` FK to tickets, blocklist, and readiness_scans. Replace single-account setup gate with admin-first registration + user CRUD. Frontend gains a project switcher dropdown and user management panel.

**Tech Stack:** TypeScript, Node.js `http` server, better-sqlite3 (embedded SQLite), React/Vite, React Router, TanStack Query, Tailwind CSS. Existing Router already supports `:param` segments.

## Global Constraints

- Run `npm run build && npm run test` before and after any code change
- Append one line to `CHANGELOG.md` per completed task
- Check off task checkboxes in this plan file on completion
- On the final task of the plan, flip Phase 2 multi-project checkbox in `docs/roadmap.md`
- No real agent invocations during tests — tests use fake invokers/CLI binaries
- Use existing patterns: `db.prepare().run()`, `sendJson(res, code, body)`, `router.get/post/put/delete(path, handler)`
- `project_id` is always a UUID — parameterized queries prevent injection, but validate input shape
- Project deletion is disallowed while a ticket run is active for that project (`status = 'in_progress'`)

---

## File Structure

### New files
- `src/db/migrations/0012_multi_project.ts` — migration
- `src/routes/users.ts` — user CRUD endpoints
- `web/src/api/users.ts` — frontend API client for user management
- `web/src/components/ProjectSwitcher.tsx` — project dropdown in top bar
- `web/src/components/UserManagementSection.tsx` — admin user panel

### Modified files (grouped by layer)

**Database:**
- `src/db/migrations/index.ts` — register new migration
- `src/db/project.ts` — add `getById`, `listProjects`, `deleteProject`; keep `getCurrentProject`
- `src/db/tickets.ts` — add `projectId` param to all functions
- `src/db/readiness-scans.ts` — add `projectId` param to all functions
- `src/db/blocklist.ts` — add `projectId` param to all functions
- `src/db/users.ts` — add `is_admin`, `must_change_password` to User interface and queries; add `listUsers`, `deleteUser`, `updatePassword`, `updateUser`

**Auth:**
- `src/auth/service.ts` — admin-first register, `changePassword`, `resetPassword`; add `mustChangePassword` to AuthResult

**Routes:**
- `src/routes/tickets.ts` — nest under `/api/projects/:projectId`
- `src/routes/ticket-run.ts` — nest under `/api/projects/:projectId`
- `src/routes/scans.ts` — nest under `/api/projects/:projectId`
- `src/routes/projects.ts` — add `GET /api/projects` (list), `GET /api/projects/:id`, `DELETE /api/projects/:id`; update `POST /api/projects/connect` to allow multiple
- `src/routes/auth.ts` — add `POST /api/auth/change-password`; update register to check admin gate
- `src/routes/users.ts` — NEW: `GET /api/users`, `POST /api/users`, `DELETE /api/users/:id`, `POST /api/users/:id/reset-password`
- `src/routes/purge.ts` — update table list (remove `instance_settings`)

**Pipeline & Scanner:**
- `src/pipeline/ticket-runner.ts` — accept `projectId` param instead of calling `getCurrentProject`
- `src/scanner/run-scan.ts` — accept `projectId` param

**Server:**
- `src/web-server.ts` — register new user routes; update route registration signatures

**Frontend API:**
- `web/src/api/tickets.ts` — add `projectId` to all URLs
- `web/src/api/projects.ts` — add `fetchProjects`, `fetchProject`, `deleteProject`; remove `fetchCurrentProject`, `clearProject` → `deleteProject`
- `web/src/api/scans.ts` — add `projectId` param
- `web/src/api/users.ts` — NEW
- `web/src/api/auth.ts` — add `changePassword`

**Frontend hooks:**
- `web/src/hooks/useProject.ts` — multi-project: `projects` list, `currentProjectId`, `switchProject`
- `web/src/hooks/useScan.ts` — add `projectId` param
- `web/src/hooks/useTicketRun.ts` — add `projectId` param
- `web/src/hooks/useAuth.ts` — add `mustChangePassword` to state

**Frontend components:**
- `web/src/App.tsx` — restructure routing: `/projects/:id`, `/settings`
- `web/src/components/Sidebar.tsx` — replace hardcoded nav with project-aware links
- `web/src/components/ProjectSwitcher.tsx` — NEW
- `web/src/components/ProjectSection.tsx` — update for multi-project; add delete project button
- `web/src/components/Settings.tsx` — restructure with tabs
- `web/src/components/UserManagementSection.tsx` — NEW
- `web/src/components/AuthGate.tsx` — handle `mustChangePassword` flow
- `web/src/components/Integrations.tsx` — update API calls (if any project-specific calls)

**Tests** — every changed source file's corresponding test file must be updated.

---

### Task 1: Database Migration

**Files:**
- Create: `src/db/migrations/0012_multi_project.ts`
- Modify: `src/db/migrations/index.ts`

**Interfaces:**
- Consumes: Migration type from `src/db/migrations/types.ts` (`{ version: number; name: string; sql: string }`)
- Produces: Migration version 12 registered in the migration index

- [ ] **Step 1: Create the migration file**

```typescript
// src/db/migrations/0012_multi_project.ts
import type { Migration } from "./types.js";

export const migration0012MultiProject: Migration = {
  version: 12,
  name: "multi-project",
  sql: `
-- Add project_id columns (nullable initially for backfill)
ALTER TABLE tickets ADD COLUMN project_id TEXT REFERENCES project(id);
ALTER TABLE blocklist ADD COLUMN project_id TEXT REFERENCES project(id);
ALTER TABLE readiness_scans ADD COLUMN project_id TEXT REFERENCES project(id);

-- Add user columns
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

-- If no project row exists but we have orphan data (pre-project-era instance),
-- create a synthetic default project so backfill has something to reference.
-- The NOT NULL constraint on the recreated tables requires every row to have
-- a valid project_id; a synthetic project is the safest fallback.
INSERT OR IGNORE INTO project (id, provider, owner, repo_slug, default_branch, clone_status, clone_error, connected_at)
  SELECT '00000000-0000-0000-0000-000000000000', 'github', 'unknown', 'unknown', 'main', 'failed', 'migration default — reconnect a real project', datetime('now')
  WHERE NOT EXISTS (SELECT 1 FROM project LIMIT 1);

-- Backfill: set project_id on all existing rows to the most-recently-connected
-- project (which is now guaranteed to exist after the fallback above).
UPDATE tickets SET project_id = (
  SELECT id FROM project ORDER BY connected_at DESC, id DESC LIMIT 1
) WHERE project_id IS NULL;

UPDATE blocklist SET project_id = (
  SELECT id FROM project ORDER BY connected_at DESC, id DESC LIMIT 1
) WHERE project_id IS NULL;

UPDATE readiness_scans SET project_id = (
  SELECT id FROM project ORDER BY connected_at DESC, id DESC LIMIT 1
) WHERE project_id IS NULL;

-- Make project_id NOT NULL after backfill
-- SQLite doesn't support ALTER COLUMN, so we recreate tables
CREATE TABLE tickets_new (
  key TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id),
  summary TEXT,
  description TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  stage TEXT,
  needs_human_category TEXT,
  needs_human_reason TEXT,
  pr_url TEXT,
  pr_summary TEXT,
  started_at TEXT,
  finished_at TEXT,
  worktree_path TEXT,
  branch_name TEXT,
  quick_win_choices TEXT,
  quick_win_attempts INTEGER NOT NULL DEFAULT 0,
  issue_type TEXT,
  priority TEXT,
  sprint TEXT,
  story_points INTEGER,
  team TEXT,
  assignee TEXT,
  parent_key TEXT,
  attachments TEXT,
  jira_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO tickets_new SELECT * FROM tickets;
DROP TABLE tickets;
ALTER TABLE tickets_new RENAME TO tickets;

CREATE TABLE blocklist_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id),
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('human', 'agent')),
  proposed_by_scan_id TEXT REFERENCES readiness_scans(id),
  created_at TEXT NOT NULL
);
INSERT INTO blocklist_new SELECT * FROM blocklist;
DROP TABLE blocklist;
ALTER TABLE blocklist_new RENAME TO blocklist;

CREATE TABLE readiness_scans_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id),
  status TEXT NOT NULL DEFAULT 'running',
  project_name TEXT,
  project_description TEXT,
  tech_stack TEXT,
  test_command TEXT,
  area_signals TEXT,
  recommendations TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
INSERT INTO readiness_scans_new SELECT * FROM readiness_scans;
DROP TABLE readiness_scans;
ALTER TABLE readiness_scans_new RENAME TO readiness_scans;

-- Set existing user(s) as admin, no password change required
UPDATE users SET is_admin = 1, must_change_password = 0 WHERE is_admin = 0;

-- Drop vestigial instance_settings
DROP TABLE IF EXISTS instance_settings;

-- Index on project_id for common queries
CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_blocklist_project ON blocklist(project_id);
CREATE INDEX idx_scans_project ON readiness_scans(project_id);
`,
};
```

- [ ] **Step 2: Register the migration in the index**

In `src/db/migrations/index.ts`, add import and array entry:

```typescript
import { migration0012MultiProject } from "./0012_multi_project.js";
// Add to the migrations array:
  migration0012MultiProject,
```

- [ ] **Step 3: Run existing tests to confirm migration doesn't break anything**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/0012_multi_project.ts src/db/migrations/index.ts
git commit -m "feat: add multi-project migration (project_id FKs, user admin flag)"
```

---

### Task 2: DB Layer — project_id on tickets, blocklist, scans

**Files:**
- Modify: `src/db/tickets.ts`
- Modify: `src/db/readiness-scans.ts`
- Modify: `src/db/blocklist.ts`
- Modify: `src/db/tickets.test.ts`
- Modify: `src/db/readiness-scans.test.ts`
- Modify: `src/db/blocklist.test.ts`

**Interfaces:**
- Consumes: migration from Task 1 with `project_id` NOT NULL columns
- Produces: all DB functions accept `projectId: string` parameter; tests pass

- [ ] **Step 1: Update tickets.ts — add projectId to every function signature and query**

In `src/db/tickets.ts`:

- Add `projectId: string` to `CreateTicketInput` interface
- Add `projectId` to `createTicket` INSERT (add to VALUES, add to params array)
- Add `projectId: string` to `listTickets` — add `WHERE project_id = ?` to SELECT
- Add `projectId: string` to `getTicket` — add `AND project_id = ?` to WHERE
- Add `projectId: string` to `updateTicket` — add `AND project_id = ?` to initial SELECT check and the final re-fetch
- Add `projectId: string` to `deleteTicket` — add `AND project_id = ?` to WHERE

Exact signatures:

```typescript
export interface CreateTicketInput {
  projectId: string;  // NEW
  id: string;
  summary?: string;
  description: string;
  url: string | null;
  // ... rest unchanged
}

export function createTicket(db: Database.Database, input: CreateTicketInput): Ticket {
  // INSERT now includes project_id as first column after key
  db.prepare(
    `INSERT INTO tickets (key, project_id, summary, description, url, status, created_at, updated_at, ...)
     VALUES (?, ?, ?, ?, ?, 'backlog', ?, ?, ...)`,
  ).run(key, input.projectId, ...);
  // ...
}

export function listTickets(db: Database.Database, projectId: string): Ticket[] {
  const rows = db.prepare(
    "SELECT * FROM tickets WHERE project_id = ? ORDER BY created_at DESC, rowid DESC"
  ).all(projectId) as Record<string, unknown>[];
  return rows.map(normaliseTicket);
}

export function getTicket(db: Database.Database, projectId: string, key: string): Ticket | null {
  const row = db.prepare("SELECT * FROM tickets WHERE key = ? AND project_id = ?").get(key, projectId) as Record<string, unknown> | undefined;
  // ...
}

export function updateTicket(db: Database.Database, projectId: string, key: string, input: UpdateTicketInput): Ticket | null {
  const existing = db.prepare("SELECT key FROM tickets WHERE key = ? AND project_id = ?").get(key, projectId);
  // ... all UPDATE statements unchanged, but final re-fetch adds AND project_id = ?
  const row = db.prepare("SELECT * FROM tickets WHERE key = ? AND project_id = ?").get(key, projectId) as Record<string, unknown>;
}

export function deleteTicket(db: Database.Database, projectId: string, key: string): boolean {
  const result = db.prepare("DELETE FROM tickets WHERE key = ? AND project_id = ?").run(key, projectId);
  return result.changes > 0;
}
```

- [ ] **Step 2: Update readiness-scans.ts — add projectId**

In `src/db/readiness-scans.ts`:

- Add `projectId: string` to `startReadinessScan`, `completeReadinessScan`, `abortReadinessScan`, `failReadinessScan`, `getLatestReadinessScan`
- INSERT includes `project_id` column
- `getLatestReadinessScan` adds `WHERE project_id = ?`

```typescript
export function startReadinessScan(db: Database.Database, projectId: string, id: string): ReadinessScan {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO readiness_scans (id, project_id, status, started_at)
     VALUES (?, ?, 'running', ?)`,
  ).run(id, projectId, now);
  return mapRow(db, id)!;
}

export function getLatestReadinessScan(db: Database.Database, projectId: string): ReadinessScan | null {
  const row = db
    .prepare(
      `SELECT * FROM readiness_scans
       WHERE project_id = ?
       ORDER BY started_at DESC, id DESC
       LIMIT 1`,
    )
    .get(projectId) as RawRow | undefined;
  return row ? toScan(row) : null;
}
```

- [ ] **Step 3: Update blocklist.ts — add projectId**

```typescript
export interface BlocklistInsert {
  projectId: string;  // NEW
  pattern: string;
  reason: string;
  source: "human" | "agent";
  proposedByScanId: string | null;
}

export function insertBlocklistEntry(db: Database.Database, input: BlocklistInsert): BlocklistEntry {
  db.prepare(
    `INSERT INTO blocklist (id, project_id, pattern, reason, source, proposed_by_scan_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.projectId, input.pattern, ...);
  // ...
}

export function getBlocklistEntries(db: Database.Database, projectId: string): BlocklistEntry[] {
  const rows = db
    .prepare("SELECT * FROM blocklist WHERE project_id = ? ORDER BY pattern")
    .all(projectId) as RawRow[];
  return rows.map(toEntry);
}

export function deleteBlocklistEntry(db: Database.Database, projectId: string, id: string): void {
  db.prepare("DELETE FROM blocklist WHERE id = ? AND project_id = ?").run(id, projectId);
}
```

- [ ] **Step 4: Update test files**

In `src/db/tickets.test.ts`:
- Every call to `createTicket(db, input)` now includes `projectId: project.id`
- Every call to `listTickets(db)` → `listTickets(db, project.id)`
- Every call to `getTicket(db, key)` → `getTicket(db, project.id, key)`
- Every call to `updateTicket(db, key, input)` → `updateTicket(db, project.id, key, input)`
- Every call to `deleteTicket(db, key)` → `deleteTicket(db, project.id, key)`
- Create a test project before running ticket tests

In `src/db/readiness-scans.test.ts`:
- Add `projectId` param to all calls
- Create a test project

In `src/db/blocklist.test.ts`:
- Add `projectId` to `insertBlocklistEntry` calls
- Add `projectId` to `getBlocklistEntries` and `deleteBlocklistEntry`
- Create a test project

- [ ] **Step 5: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/db/tickets.ts src/db/readiness-scans.ts src/db/blocklist.ts src/db/tickets.test.ts src/db/readiness-scans.test.ts src/db/blocklist.test.ts
git commit -m "feat: add project_id to tickets, blocklist, and readiness_scans DB functions"
```

---

### Task 3: DB Layer — Users admin flag and management functions

**Files:**
- Modify: `src/db/users.ts`
- Modify: `src/db/users.test.ts`

**Interfaces:**
- Consumes: migration from Task 1 with `is_admin`, `must_change_password` columns
- Produces: User interface with new fields; `listUsers`, `deleteUser`, `updatePassword`, `updateUser` functions

- [ ] **Step 1: Update User interface and existing queries**

```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isAdmin: boolean;          // NEW
  mustChangePassword: boolean; // NEW
  createdAt: string;
}

interface RawRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number;           // NEW
  must_change_password: number; // NEW
  created_at: string;
}

function mapRow(row: RawRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin === 1,           // NEW
    mustChangePassword: row.must_change_password === 1, // NEW
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 2: Add new user management functions**

```typescript
export function listUsers(db: Database.Database): User[] {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at").all() as RawRow[];
  return rows.map(mapRow);
}

export function deleteUser(db: Database.Database, id: string): boolean {
  // Delete sessions first (FK)
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updatePassword(db: Database.Database, id: string, passwordHash: string): boolean {
  const result = db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(passwordHash, id);
  return result.changes > 0;
}

export function updateUser(db: Database.Database, id: string, fields: { mustChangePassword?: boolean }): boolean {
  if (fields.mustChangePassword !== undefined) {
    const result = db.prepare(
      "UPDATE users SET must_change_password = ? WHERE id = ?"
    ).run(fields.mustChangePassword ? 1 : 0, id);
    return result.changes > 0;
  }
  return false;
}

export function anyAdminExists(db: Database.Database): boolean {
  return db.prepare("SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1").get() !== undefined;
}
```

- [ ] **Step 3: Update users.test.ts**

```typescript
// Test that created user has isAdmin = false and mustChangePassword = true (defaults from migration)
// Test listUsers returns all users
// Test deleteUser cascades to sessions
// Test updatePassword changes hash and resets must_change_password
// Test anyAdminExists
```

- [ ] **Step 4: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/db/users.ts src/db/users.test.ts
git commit -m "feat: add admin flag, must_change_password, and user management functions to db/users"
```

---

### Task 4: Auth Service — admin-first registration, password change/reset

**Files:**
- Modify: `src/auth/service.ts`
- Modify: `src/auth/service.test.ts`

**Interfaces:**
- Consumes: updated `db/users.ts` from Task 3
- Produces: `register` gated on admin existence; `changePassword`, `resetPassword` functions; `mustChangePassword` in AuthResult

- [ ] **Step 1: Update register to use admin gate**

Replace `anyUserExists` / `setupRequired` with admin-aware logic:

```typescript
import { anyAdminExists } from "../db/users.js";

export function setupRequired(db: Database.Database): boolean {
  return !anyAdminExists(db);
}

export async function register(
  db: Database.Database,
  input: RegisterInput,
): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  // Allow first-ever registration (no admin exists) — this user becomes admin
  // After that, only existing admins can create users via POST /api/users
  if (anyAdminExists(db)) {
    throw new AuthError(403, "setup already completed — ask an admin to create an account");
  }

  const user = createUser(db, {
    username: input.username,
    email: input.email,
    passwordHash,
  });
  // Set first user as admin
  db.prepare("UPDATE users SET is_admin = 1, must_change_password = 0 WHERE id = ?").run(user.id);

  const session = createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}
```

- [ ] **Step 2: Update login to include mustChangePassword flag**

```typescript
export async function login(db: Database.Database, input: Credentials): Promise<AuthResult & { mustChangePassword: boolean }> {
  // ... same password check ...
  const session = createSession(db, user.id, sessionExpiryIso());
  return {
    user: { username: user.username, email: user.email },
    session,
    mustChangePassword: user.mustChangePassword,
  };
}
```

- [ ] **Step 3: Add changePassword function**

```typescript
export async function changePassword(
  db: Database.Database,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getUserById(db, userId);
  if (!user) throw new AuthError(404, "user not found");

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordOk) throw new AuthError(401, "current password is incorrect");

  const newHash = await hashPassword(newPassword);
  updatePassword(db, userId, newHash);
}
```

- [ ] **Step 4: Add adminResetPassword function**

```typescript
export async function adminResetPassword(
  db: Database.Database,
  targetUserId: string,
  newPassword: string,
): Promise<void> {
  const newHash = await hashPassword(newPassword);
  const updated = updatePassword(db, targetUserId, newHash);
  if (!updated) throw new AuthError(404, "user not found");
  // Force password change on next login
  updateUser(db, targetUserId, { mustChangePassword: true });
}
```

- [ ] **Step 5: Update auth/service.test.ts**

- Test: first registration succeeds and creates admin
- Test: second registration is rejected (admin already exists)
- Test: login returns `mustChangePassword: true` for fresh user
- Test: `changePassword` succeeds with correct current password
- Test: `changePassword` fails with incorrect current password
- Test: `adminResetPassword` updates hash and sets `mustChangePassword`

- [ ] **Step 6: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 7: Commit**

```bash
git add src/auth/service.ts src/auth/service.test.ts
git commit -m "feat: admin-first registration, changePassword, adminResetPassword in auth service"
```

---

### Task 5: Routes — project-scoped tickets

**Files:**
- Modify: `src/routes/tickets.ts`

**Interfaces:**
- Consumes: updated `db/tickets.ts` from Task 2, Router with `:projectId` param
- Produces: all ticket routes under `/api/projects/:projectId/tickets*`

- [ ] **Step 1: Rewrite registerTicketRoutes to accept project prefix**

```typescript
export function registerTicketRoutes(router: Router, db: Database.Database): void {
  const prefix = "/api/projects/:projectId";

  router.post(`${prefix}/tickets`, async (req, res, params) => {
    const projectId = params.projectId!;
    // ... same body parsing ...
    const input: CreateTicketInput = {
      projectId,
      id: id || "",
      summary,
      description,
      url,
      // ... Jira metadata fields ...
    };
    try {
      const ticket = createTicket(db, input);
      sendJson(res, 201, ticket);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
    }
  });

  router.get(`${prefix}/tickets`, (_req, res, params) => {
    sendJson(res, 200, listTickets(db, params.projectId!));
  });

  router.put(`${prefix}/tickets/:key`, async (req, res, params) => {
    // ... body parsing ...
    const ticket = updateTicket(db, params.projectId!, params.key!, input);
    if (!ticket) { sendJson(res, 404, { error: "ticket not found" }); return; }
    sendJson(res, 200, ticket);
  });

  router.delete(`${prefix}/tickets/:key`, (_req, res, params) => {
    const deleted = deleteTicket(db, params.projectId!, params.key!);
    if (!deleted) { sendJson(res, 404, { error: "ticket not found" }); return; }
    sendJson(res, 200, { deleted: true });
  });

  router.post(`${prefix}/tickets/pull`, async (_req, res, params) => {
    try {
      // pullJiraTickets currently takes "RR" as project key — keep as is for now
      // (full Jira-project mapping is a separate phase)
      const result = await pullJiraTickets("RR");
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "pull tickets");
    }
  });
}
```

- [ ] **Step 2: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/tickets.ts
git commit -m "feat: nest ticket routes under /api/projects/:projectId"
```

---

### Task 6: Routes — project-scoped scans

**Files:**
- Modify: `src/routes/scans.ts`

**Interfaces:**
- Consumes: updated `db/readiness-scans.ts` from Task 2
- Produces: scan routes under `/api/projects/:projectId/scans*`

- [ ] **Step 1: Nest all scan routes under project prefix**

```typescript
export function registerScanRoutes(
  router: Router,
  db: Database.Database,
  runScan: (projectId: string, scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void>,
  reposDir: string,
): void {
  const prefix = "/api/projects/:projectId";

  router.post(`${prefix}/scans/run`, async (req, res, params) => {
    const projectId = params.projectId!;
    const repoPath = getProjectRepoPath(db, reposDir);
    // ...
    startReadinessScan(db, projectId, scanId);
    // Fire-and-forget
    runScan(projectId, scanId, repoPath, controller.signal, modelId)
      .catch(() => { failReadinessScan(db, scanId); })
      .finally(() => { inFlight.delete(scanId); });
    // ...
  });

  router.get(`${prefix}/scans/latest`, (_req, res, params) => {
    const scan = getLatestReadinessScan(db, params.projectId!);
    sendJson(res, 200, scan);
  });

  router.post(`${prefix}/scans/abort`, async (req, res, params) => {
    // ... same logic, uses getLatestReadinessScan(db, params.projectId!)
  });
}
```

- [ ] **Step 2: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/scans.ts
git commit -m "feat: nest scan routes under /api/projects/:projectId"
```

---

### Task 7: Routes — project-scoped blocklist (inline in projects route or dedicated route)

**Files:**
- Modify: `src/routes/projects.ts` — add blocklist routes

**Note:** Blocklist routes currently don't exist as a separate route file. They're embedded in the projects route or need to be added. Let's add them alongside in projects.ts for now.

```typescript
// Inside registerProjectRoutes, add blocklist sub-routes:

const prefix = "/api/projects/:projectId";

router.get(`${prefix}/blocklist`, (_req, res, params) => {
  sendJson(res, 200, getBlocklistEntries(db, params.projectId!));
});

router.post(`${prefix}/blocklist`, async (req, res, params) => {
  const projectId = params.projectId!;
  let body: unknown;
  try { body = await readJsonBody(req); } catch (err) { sendCaughtError(res, err, "blocklist insert"); return; }
  const candidate = body as Record<string, unknown> | null;
  if (!candidate || typeof candidate.pattern !== "string" || typeof candidate.reason !== "string") {
    sendJson(res, 400, { error: "pattern and reason are required" });
    return;
  }
  const entry = insertBlocklistEntry(db, {
    projectId,
    pattern: candidate.pattern,
    reason: candidate.reason,
    source: "human",
    proposedByScanId: null,
  });
  sendJson(res, 201, entry);
});

router.delete(`${prefix}/blocklist/:entryId`, (_req, res, params) => {
  deleteBlocklistEntry(db, params.projectId!, params.entryId!);
  sendJson(res, 200, { deleted: true });
});
```

- [ ] **Step 1: Add blocklist routes to projects.ts**

- [ ] **Step 2: Run tests**

- [ ] **Step 3: Commit**

---

### Task 8: Routes — project CRUD (list, get, delete) and multi-project connect

**Files:**
- Modify: `src/routes/projects.ts`
- Modify: `src/db/project.ts`

**Interfaces:**
- Consumes: existing project DB functions
- Produces: `GET /api/projects`, `GET /api/projects/:id`, `DELETE /api/projects/:id`, updated connect (no 409 conflict)

- [ ] **Step 1: Add DB functions for list, get, delete**

In `src/db/project.ts`:

```typescript
export function getById(db: Database.Database, id: string): Project | null {
  // Make public — currently private
  // ... existing implementation
}

export function listProjects(db: Database.Database): Project[] {
  const rows = db.prepare("SELECT * FROM project ORDER BY connected_at DESC").all() as RawRow[];
  return rows.map(toProject);
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const result = db.prepare("DELETE FROM project WHERE id = ?").run(id);
  return result.changes > 0;
}

// Rename clearProject to deleteProject — keep clearProject as deprecation wrapper
export function clearProject(db: Database.Database): void {
  db.prepare("DELETE FROM project").run();
}
```

- [ ] **Step 2: Add new routes**

```typescript
router.get("/api/projects", (_req, res) => {
  sendJson(res, 200, listProjects(db));
});

router.get("/api/projects/:id", (_req, res, params) => {
  const project = getById(db, params.id!);
  if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }
  sendJson(res, 200, project);
});

// Remove /api/projects/current — replaced by /api/projects/:id
// Remove /api/projects/clear — replaced by DELETE /api/projects/:id

router.delete("/api/projects/:id", (_req, res, params) => {
  const projectId = params.id!;
  const project = getById(db, projectId);
  if (!project) { sendJson(res, 404, { error: "Project not found" }); return; }

  // Guard: don't delete if any ticket is in progress
  const activeRun = db.prepare(
    "SELECT 1 FROM tickets WHERE project_id = ? AND status = 'in_progress' LIMIT 1"
  ).get(projectId);
  if (activeRun) {
    sendJson(res, 409, { error: "Cannot delete project with active ticket runs" });
    return;
  }

  // Cascade delete
  db.transaction(() => {
    db.prepare("DELETE FROM tickets WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM blocklist WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM readiness_scans WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project WHERE id = ?").run(projectId);
  })();

  // Remove clone directory
  const cloneDir = join(deps.reposDir, projectId);
  if (existsSync(cloneDir)) rmSync(cloneDir, { recursive: true, force: true });

  sendJson(res, 200, { deleted: true });
});

// Update POST /api/projects/connect — remove 409 "already connected" guard
// Remove the line that checks getCurrentProject(db) and returns 409
```

- [ ] **Step 3: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/projects.ts src/db/project.ts
git commit -m "feat: multi-project CRUD — list, get, delete, connect-allowed"
```

---

### Task 9: Routes — user management endpoints

**Files:**
- Create: `src/routes/users.ts`
- Modify: `src/web-server.ts`

**Interfaces:**
- Consumes: auth service from Task 4, db/users from Task 3
- Produces: `GET /api/users`, `POST /api/users`, `DELETE /api/users/:id`, `POST /api/users/:id/reset-password`

- [ ] **Step 1: Create users.ts routes**

```typescript
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import type { IncomingMessage } from "node:http";
import { listUsers, deleteUser, getUserById } from "../db/users.js";
import { adminResetPassword } from "../auth/service.js";
import { createUser } from "../db/users.js";
import { hashPassword } from "../auth/password.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, readJsonBody, sendCaughtError } from "../http-utils.js";

/** Re-authenticates the request (the auth middleware already ran, but we need
 * the userId to check admin status). Returns null if session is invalid. */
function getUserId(db: Database.Database, req: IncomingMessage): string | null {
  const auth = authenticateRequest(db, req);
  return auth?.userId ?? null;
}

function requireAdmin(db: Database.Database, req: IncomingMessage): string | null {
  const userId = getUserId(db, req);
  if (!userId) return null;
  const user = getUserById(db, userId);
  return user?.isAdmin === true ? userId : null;
}

export function registerUserRoutes(router: Router, db: Database.Database): void {
  router.get("/api/users", (req, res, _params) => {
    const userId = requireAdmin(db, req);
    if (!userId) { sendJson(res, 403, { error: "admin only" }); return; }
    const users = listUsers(db).map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      isAdmin: u.isAdmin,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    }));
    sendJson(res, 200, users);
  });

  router.post("/api/users", async (req, res, _params) => {
    const userId = requireAdmin(db, req);
    if (!userId) { sendJson(res, 403, { error: "admin only" }); return; }
    let body: unknown;
    try { body = await readJsonBody(req); } catch (err) { sendCaughtError(res, err, "create user"); return; }
    const { username, email, password } = (body as Record<string, unknown>) ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      sendJson(res, 400, { error: "username and password are required" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = createUser(db, {
      username,
      email: typeof email === "string" ? email : "",
      passwordHash,
    });
    sendJson(res, 201, {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      mustChangePassword: user.mustChangePassword,
    });
  });

  router.delete("/api/users/:id", (req, res, params) => {
    const userId = requireAdmin(db, req);
    if (!userId) { sendJson(res, 403, { error: "admin only" }); return; }
    // Don't allow self-deletion
    if (params.id === userId) {
      sendJson(res, 400, { error: "cannot delete your own account" });
      return;
    }
    const deleted = deleteUser(db, params.id!);
    if (!deleted) { sendJson(res, 404, { error: "user not found" }); return; }
    sendJson(res, 200, { deleted: true });
  });

  router.post("/api/users/:id/reset-password", async (req, res, params) => {
    const userId = requireAdmin(db, req);
    if (!userId) { sendJson(res, 403, { error: "admin only" }); return; }
    let body: unknown;
    try { body = await readJsonBody(req); } catch (err) { sendCaughtError(res, err, "reset password"); return; }
    const password = (body as Record<string, unknown> | null)?.["password"];
    if (typeof password !== "string") {
      sendJson(res, 400, { error: "password is required" });
      return;
    }
    try {
      await adminResetPassword(db, params.id!, password);
      sendJson(res, 200, { reset: true });
    } catch (err) {
      sendCaughtError(res, err, "reset password");
    }
  });
}
```

- [ ] **Step 2: Update web-server.ts to register user routes**

```typescript
import { registerUserRoutes } from "./routes/users.js";
// ...
registerUserRoutes(router, db);
```

- [ ] **Step 3: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/users.ts src/web-server.ts
git commit -m "feat: admin user management routes — list, create, delete, reset-password"
```

---

### Task 10: Routes — ticket-run and auth updates for project scoping

**Files:**
- Modify: `src/routes/ticket-run.ts`
- Modify: `src/routes/auth.ts`

**Interfaces:**
- Consumes: project-scoped DB functions from Tasks 2-3, auth service from Task 4
- Produces: ticket-run routes under `/api/projects/:projectId/tickets/:key/*`, auth routes with `mustChangePassword`

- [ ] **Step 1: Update ticket-run.ts — nest under project prefix**

In `src/routes/ticket-run.ts`:

```typescript
export function registerTicketRunRoutes(
  router: Router,
  db: Database.Database,
  createInvoker: InvokerFactory,
  reposDir: string,
): void {
  const prefix = "/api/projects/:projectId";

  router.post(`${prefix}/tickets/:key/run`, async (req, res, params) => {
    const projectId = params.projectId!;
    const repoPath = getProjectRepoPath(db, reposDir);
    if (!repoPath) {
      sendJson(res, 503, { error: "No project configured." });
      return;
    }

    const ticketKey = params.key!;
    const ticket = getTicket(db, projectId, ticketKey);
    // ... rest unchanged — pass projectId to runTicketPipeline
    runTicketPipeline(db, createInvoker, projectId, ticketKey, repoPath, modelId, broadcast, controller.signal)
    // ...
  });

  router.post(`${prefix}/tickets/:key/resolve`, async (req, res, params) => {
    const projectId = params.projectId!;
    const ticket = getTicket(db, projectId, params.key!);
    // ... same updateTicket(db, projectId, ...) calls
  });

  router.get(`${prefix}/tickets/:key/stream`, (req, res, params) => {
    const projectId = params.projectId!;
    const ticket = getTicket(db, projectId, params.key!);
    // ... rest unchanged
  });
}
```

- [ ] **Step 2: Update auth.ts — add change-password and mustChangePassword to login response**

In `src/routes/auth.ts`:

```typescript
router.post("/api/auth/change-password", async (req, res) => {
  const auth = authenticateRequest(db, req);
  if (!auth) { sendJson(res, 401, { error: "unauthorized" }); return; }
  try {
    const body = (await readJsonBody(req)) as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword) {
      sendJson(res, 400, { error: "currentPassword and newPassword are required" });
      return;
    }
    await changePassword(db, auth.userId, body.currentPassword, body.newPassword);
    sendJson(res, 200, { changed: true });
  } catch (err) {
    sendCaughtError(res, err, "change password");
  }
});
```

Update login handler to include `mustChangePassword`:

```typescript
// In handleAuthRequest, capture the extra field:
function handleAuthRequest(res: ServerResponse, run: () => Promise<AuthResult & { mustChangePassword?: boolean }>) {
  run().then((result) => {
    sendJson(res, 200, {
      user: result.user,
      mustChangePassword: result.mustChangePassword ?? false,
    }, { "set-cookie": buildSessionCookie(result.session.token, COOKIE_SECURE) });
  }).catch(...)
}
```

Update `GET /api/auth/me` to include `mustChangePassword`:

```typescript
router.get("/api/auth/me", (_req, res) => {
  // ... existing logic ...
  const user = getUserById(db, auth.userId);
  sendJson(res, 200, {
    state: "authenticated",
    user: { username: user?.username ?? "" },
    mustChangePassword: user?.mustChangePassword ?? false,
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/ticket-run.ts src/routes/auth.ts
git commit -m "feat: project-scoped ticket-run routes, change-password endpoint, mustChangePassword in auth"
```

---

### Task 11: Pipeline — project-aware ticket-runner

**Files:**
- Modify: `src/pipeline/ticket-runner.ts`
- Modify: `src/pipeline/ticket-runner.test.ts`

**Interfaces:**
- Consumes: project-scoped DB functions from Task 2
- Produces: `runTicketPipeline` accepts `projectId` instead of calling `getCurrentProject` internally

- [ ] **Step 1: Update runTicketPipeline signature**

```typescript
export async function runTicketPipeline(
  db: Database.Database,
  createInvoker: InvokerFactory,
  projectId: string,  // NEW — was ticketKey third, now third param
  ticketKey: string,
  repoPath: string,
  modelId: string | null,
  onEvent: (event: TicketRunEvent) => void,
  signal: AbortSignal,
): Promise<void> {
```

- [ ] **Step 2: Update all internal DB calls**

- `getTicket(db, ticketKey)` → `getTicket(db, projectId, ticketKey)`
- `updateTicket(db, ticketKey, ...)` → `updateTicket(db, projectId, ticketKey, ...)`
- `getBlocklistEntries(db)` → `getBlocklistEntries(db, projectId)`
- `getCurrentProject(db)` → use `getProjectById` or pass project through

- [ ] **Step 3: Update runImplement and runOpenPr stages**

In `runImplement`:
```typescript
const project = db.prepare("SELECT * FROM project WHERE id = ?").get(projectId) as RawProjectRow | undefined;
```

In `runOpenPr`:
```typescript
const fresh = getTicket(db, projectId, ticket.key);
const project = db.prepare("SELECT * FROM project WHERE id = ?").get(projectId) as RawProjectRow | undefined;
```

- [ ] **Step 4: Update ticket-runner.test.ts**

Update all calls to match new signature. Create a test project before running pipeline tests.

- [ ] **Step 5: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/ticket-runner.ts src/pipeline/ticket-runner.test.ts
git commit -m "feat: project-aware ticket pipeline — pass projectId explicitly"
```

---

### Task 12: Scanner — project-aware scan runner

**Files:**
- Modify: `src/scanner/run-scan.ts`
- Modify: `src/scanner/run-scan.test.ts`

**Interfaces:**
- Consumes: project-scoped DB functions from Task 2
- Produces: scan runner accepts `projectId` param

- [ ] **Step 1: Update createScanRunner to pass projectId through**

```typescript
export function createScanRunner(
  db: Database.Database,
  createInvoker: InvokerFactory,
): (projectId: string, scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void> {
  return async (projectId: string, scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => {
    // ... mechanical pass unchanged ...

    // Insert blocklist entries with projectId
    for (const proposal of agentResult.blocklistProposals) {
      insertBlocklistEntry(db, {
        projectId,  // NEW
        pattern: proposal.pattern,
        reason: proposal.reason,
        source: "agent",
        proposedByScanId: scanId,
      });
    }

    // Don't call completeReadinessScan with projectId
    completeReadinessScan(db, scanId, { ... });  // completeReadinessScan doesn't need projectId since we use startReadinessScan with it
  };
}
```

Wait — `completeReadinessScan` currently doesn't take `projectId` because the scan is already identified by its `id`. The `startReadinessScan` now takes `projectId` (Task 2). So `completeReadinessScan` doesn't need to change — it updates by scan `id` only. But `startReadinessScan` needs `projectId`. This is already handled in Task 6 (scans route).

So the scan runner just needs to accept `projectId` and pass it to `insertBlocklistEntry`.

- [ ] **Step 2: Update run-scan.test.ts**

- [ ] **Step 3: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/scanner/run-scan.ts src/scanner/run-scan.test.ts
git commit -m "feat: project-aware scan runner — pass projectId to blocklist insertions"
```

---

### Task 13: Web Server — wire updated route registrations

**Files:**
- Modify: `src/web-server.ts`
- Modify: `src/routes/purge.ts` (drop instance_settings reference)

**Interfaces:**
- Consumes: all updated route modules from Tasks 5-10
- Produces: server starts and routes all requests correctly

- [ ] **Step 1: Update web-server.ts route registration**

```typescript
// Update registerScanRoutes call — runScan signature changed (now takes projectId first)
registerScanRoutes(router, db, (projectId, scanId, repoPath, signal, modelId) =>
  scanRunner(projectId, scanId, repoPath, signal, modelId), reposDir);
```

Actually the `run-scan.ts` `createScanRunner` already wraps the `scanRunner(projectId, scanId, ...)` call. Let me re-check.

In Task 12, `createScanRunner` returns `(projectId, scanId, repoPath, signal, modelId) => Promise<void>`. But `registerScanRoutes` from Task 6 expects `runScan: (projectId, scanId, repoPath, signal, modelId) => Promise<void>`.

In `registerScanRoutes`, the `runScan` parameter signature should match:
```typescript
runScan: (projectId: string, scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void>
```

And in web-server.ts:
```typescript
const scanRunner = createScanRunner(db, piInvokerFactory);
registerScanRoutes(router, db, scanRunner, reposDir);
```

This works — `scanRunner` already has the right shape after Task 12.

- [ ] **Step 2: Update purge route**

In `src/routes/purge.ts`, remove `instance_settings` from TABLES array and remove the re-seed line:

```typescript
const TABLES = [
  "blocklist",
  "readiness_scans",
  "credentials",
  "sessions",
  "tickets",
  "users",
  "project",
];
// Remove: "instance_settings" from TABLES
// Remove: db.prepare("INSERT OR IGNORE INTO instance_settings (id) VALUES (1)").run();
```

- [ ] **Step 3: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/web-server.ts src/routes/purge.ts
git commit -m "feat: wire project-scoped route registrations, purge without instance_settings"
```

---

### Task 14: Frontend — API client updates for project scoping

**Files:**
- Modify: `web/src/api/tickets.ts`
- Modify: `web/src/api/projects.ts`
- Modify: `web/src/api/scans.ts`
- Create: `web/src/api/users.ts`
- Modify: `web/src/api/auth.ts`
- Modify: `web/src/api/*.test.ts` (all test files)

**Interfaces:**
- Consumes: new API route shapes from Tasks 5-10
- Produces: frontend API functions that work with project-scoped URLs

- [ ] **Step 1: Update tickets.ts — add projectId param**

```typescript
function ticketUrl(projectId: string, suffix: string = ""): string {
  return `/api/projects/${encodeURIComponent(projectId)}/tickets${suffix}`;
}

export async function createTicket(projectId: string, data: CreateTicketData): Promise<Ticket> {
  const res = await fetch(ticketUrl(projectId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...data }),
  });
  // ... error handling unchanged
}

export async function fetchTickets(projectId: string): Promise<Ticket[]> {
  const res = await fetch(ticketUrl(projectId));
  // ...
}

export async function updateTicket(projectId: string, key: string, data: UpdateTicketData): Promise<Ticket> {
  const res = await fetch(ticketUrl(projectId, `/${encodeURIComponent(key)}`), { method: 'PUT', ... });
  // ...
}

export async function deleteTicket(projectId: string, key: string): Promise<void> {
  const res = await fetch(ticketUrl(projectId, `/${encodeURIComponent(key)}`), { method: 'DELETE' });
  // ...
}

export async function runTicket(projectId: string, key: string, modelId?: string): Promise<void> {
  const res = await fetch(ticketUrl(projectId, `/${encodeURIComponent(key)}/run`), { method: 'POST', ... });
  // ...
}

export async function resolveTicket(projectId: string, key: string, choiceIndex: number, modelId?: string): Promise<void> {
  const res = await fetch(ticketUrl(projectId, `/${encodeURIComponent(key)}/resolve`), { method: 'POST', ... });
  // ...
}

export async function pullJiraTickets(projectId: string): Promise<PullResult> {
  const res = await fetch(ticketUrl(projectId, '/pull'), { method: 'POST' });
  // ...
}
```

- [ ] **Step 2: Update projects.ts**

Remove `fetchCurrentProject` — replace with `fetchProjects` and `fetchProject`:

```typescript
export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<Project[]>;
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<Project>;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res));
}
// Keep fetchOrgs, fetchRepos, connectProject, syncProject (they stay at /api/projects/*)
```

- [ ] **Step 3: Update scans.ts — add projectId**

```typescript
export async function triggerScan(projectId: string, modelId?: string): Promise<{ scanId: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/scans/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(modelId ? { modelId } : {}),
  });
  // ...
}

export async function fetchLatestScan(projectId: string): Promise<ReadinessScan | null> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/scans/latest`);
  // ...
}

export async function abortScan(projectId: string, scanId: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/scans/abort`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scanId }),
  });
  // ...
}
```

- [ ] **Step 4: Create users.ts**

```typescript
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export async function fetchUsers(): Promise<UserInfo[]> {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
  return res.json() as Promise<UserInfo[]>;
}

export async function createUser(username: string, email: string, password: string): Promise<UserInfo> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
  return res.json() as Promise<UserInfo>;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
}
```

- [ ] **Step 5: Update auth.ts — add changePassword**

```typescript
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
}
```

Update `AuthState` to include `mustChangePassword`:
```typescript
export interface AuthState {
  state: "setup_required" | "unauthenticated" | "authenticated";
  user?: { username: string };
  mustChangePassword?: boolean;
}
```

- [ ] **Step 6: Update test files**

Update all `api/*.test.ts` files to pass `projectId` params.

- [ ] **Step 7: Run tests** (frontend tests via vitest)

```bash
npm run build && npm run test
```

- [ ] **Step 8: Commit**

```bash
git add web/src/api/
git commit -m "feat: project-scoped frontend API clients, new users API, changePassword"
```

---

### Task 15: Frontend — navigation, project switcher, routing restructure

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Sidebar.tsx`
- Create: `web/src/components/ProjectSwitcher.tsx`
- Modify: `web/src/hooks/useProject.ts`
- Modify: `web/src/hooks/useScan.ts`
- Modify: `web/src/hooks/useTicketRun.ts`
- Modify: `web/src/components/Settings.tsx`

- [ ] **Step 1: Create ProjectSwitcher component**

```tsx
// web/src/components/ProjectSwitcher.tsx
import { useNavigate, useParams } from 'react-router-dom';
import type { Project } from '../api/projects';

interface Props {
  projects: Project[];
  currentProjectId?: string;
}

export default function ProjectSwitcher({ projects, currentProjectId }: Props) {
  const navigate = useNavigate();
  const current = projects.find(p => p.id === currentProjectId);

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
        {current ? (
          <>
            <span className="text-white/40 text-xs">{current.provider === 'github' ? '' : ''}</span>
            <span>{current.owner}/{current.repoSlug}</span>
          </>
        ) : (
          <span className="text-white/40">No project</span>
        )}
        <iconify-icon icon="solar:alt-arrow-down-linear" width="12" className="text-white/40" />
      </button>

      <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="p-2">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                p.id === currentProjectId ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={p.cloneStatus === 'failed' ? 'text-red-400' : p.cloneStatus === 'cloning' ? 'text-yellow-400' : 'text-white/40'}>
                  {p.owner}/{p.repoSlug}
                </span>
                {p.cloneStatus === 'cloning' && <span className="text-xs text-yellow-400 animate-pulse">cloning…</span>}
                {p.cloneStatus === 'failed' && <span className="text-xs text-red-400" title={p.cloneError ?? ''}>failed</span>}
              </div>
            </button>
          ))}
          <hr className="my-1 border-white/5" />
          <button
            onClick={() => navigate('/settings')}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-white/50 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
          >
            <iconify-icon icon="solar:add-circle-linear" width="14" />
            Connect project…
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update useProject hook**

```typescript
// web/src/hooks/useProject.ts
export function useProject(projectId?: string) {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: currentProject, isLoading: projectLoading } = useQuery<Project | null>({
    queryKey: ['project', projectId],
    queryFn: () => projectId ? fetchProject(projectId) : null,
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as Project | null | undefined;
      return data?.cloneStatus === 'cloning' ? 2000 : false;
    },
  });

  const connectMutation = useMutation({
    mutationFn: (args: { provider: ProjectProvider; owner: string; repoSlug: string; defaultBranch: string }) =>
      connectProject(args.provider, args.owner, args.repoSlug, args.defaultBranch),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    // ...
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['project', id] });
    },
    // ...
  });

  return {
    projects,
    currentProject: currentProject ?? null,
    // ... connect, delete, sync methods
  };
}
```

- [ ] **Step 3: Update useScan hook to accept projectId**

```typescript
export function useScan(projectId: string | undefined) {
  // queryKey: ['scan', projectId]
  // fetchLatestScan(projectId!) when projectId is set
  // triggerScan(projectId!, modelId) on trigger
  // abortScan(projectId!, scanId) on abort
}
```

- [ ] **Step 4: Update useTicketRun hook to accept projectId**

```typescript
export function useTicketRun(ticket: Ticket | null, projectId: string | undefined) {
  // SSE stream URL: `/api/projects/${projectId}/tickets/${ticket.key}/stream`
}
```

- [ ] **Step 5: Update Sidebar**

```tsx
// Add ProjectSwitcher above the nav links
<ProjectSwitcher projects={projects} currentProjectId={projectId} />
```

- [ ] **Step 6: Update App.tsx routing**

New route structure:
```tsx
<Routes>
  <Route path="/projects/:projectId" element={<ProjectOverview />} />
  <Route path="/projects/:projectId/tickets" element={<TicketsPage />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/" element={<Navigate to="/settings" replace />} />
</Routes>
```

Each page extracts `projectId` from `useParams()` and passes it to hooks.

- [ ] **Step 7: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 8: Commit**

```bash
git add web/src/
git commit -m "feat: project switcher, restructured routing, project-scoped hooks"
```

---

### Task 16: Frontend — user management UI and password change

**Files:**
- Create: `web/src/components/UserManagementSection.tsx`
- Modify: `web/src/components/Settings.tsx`
- Modify: `web/src/components/AuthGate.tsx`
- Modify: `web/src/hooks/useAuth.ts`

- [ ] **Step 1: Create UserManagementSection**

Admin-only panel in Settings. Shows table of users with delete and reset-password buttons. Form to create new user (username, email, password).

- [ ] **Step 2: Update Settings.tsx with tabs**

```tsx
// Three tabs: Project, Integrations, Users (admin only), Profile (password change)
```

- [ ] **Step 3: Add mustChangePassword gate to AuthGate**

After login, if `mustChangePassword` is true, show a password change form before allowing access to the app. Use the `changePassword` API.

- [ ] **Step 4: Update useAuth.ts**

```typescript
export function useAuth() {
  // ...
  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
  // return changePassword method
}
```

- [ ] **Step 5: Run tests**

```bash
npm run build && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/UserManagementSection.tsx web/src/components/Settings.tsx web/src/components/AuthGate.tsx web/src/hooks/useAuth.ts
git commit -m "feat: user management UI, password change gate, settings tabs"
```

---

### Task 17: Final integration — end-to-end validation

**Files:**
- Modify: `docs/roadmap.md` (check off Phase 2 multi-project)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full test suite**

```bash
npm run build && npm run test
```

Fix any remaining test failures from integration issues.

- [ ] **Step 2: Update roadmap**

In `docs/roadmap.md`, flip `[ ] Multi-project support` to `[x]` and `[ ] Invite user / multi-account` to `[x]`.

- [ ] **Step 3: Update CHANGELOG**

```
- 2026-08-10: multi-project-design | @user - multi-project support with project-scoped routes, flat multi-user auth with admin user management
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: final integration, update roadmap and changelog for multi-project + multi-user"
```
