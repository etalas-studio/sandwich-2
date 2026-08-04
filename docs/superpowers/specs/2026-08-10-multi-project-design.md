# Multi-Project & Multi-User Architecture Design

Written 10 August 2026. Builds on the Phase 1 single-project/single-user architecture, adding multi-project support (~5 repos, one pipeline at a time) and flat multi-user auth (no roles beyond admin flag).

## Problem

The current architecture supports exactly one project and one user account per instance. Connecting a new project deletes the old one — tickets, blocklist, readiness scans, and the cloned repo are all wiped. There is no way to have multiple people log in, and no way to switch between repos without losing everything.

Phase 1 is done. It's time to widen the aperture.

## Scope & Constraints

| Dimension | Decision |
|---|---|
| Projects | Multiple (~5), each with its own repo connection, blocklist, scan state, and ticket queue |
| Pipeline concurrency | One project's pipeline runs at a time (switch model, not parallel) |
| Users | Multiple, flat permissions — everyone sees and operates on everything |
| Auth | Admin creates accounts (no self-registration after setup), admin flag on users |
| API shape | Project-scoped routes: `/api/projects/:projectId/tickets`, etc. |
| Approach | B from the design discussion — explicit project ID in every route now, so multi-workspace concurrency is a natural future extension |

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│                  Browser                       │
│  /projects/:id                                 │
│  /projects/:id/tickets                         │
│  /projects/:id/settings                        │
│  /settings (users, integrations, profile)      │
└────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│              Web Server (Node.js HTTP)          │
│                                                 │
│  Auth middleware → session gate on /api/*       │
│  Project-scoped routes under /api/projects/:pid  │
│  Instance-wide routes: /api/auth, /api/users,   │
│    /api/integrations, /api/projects (CRUD),      │
│    oauth callbacks                              │
└────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│              SQLite (single file)               │
│                                                 │
│  users, sessions, credentials (shared)          │
│  project (N rows, one per connected repo)       │
│  tickets, blocklist, readiness_scans            │
│    → each with project_id FK                    │
└────────────────────────────────────────────────┘
```

## Data Model

### What stays unchanged

- `users` — gains `is_admin`, `must_change_password` columns
- `sessions` — no structural changes
- `credentials` — no structural changes (OAuth tokens are instance-wide)

### What gains `project_id`

Three tables get a non-nullable `project_id TEXT NOT NULL REFERENCES project(id)`:

| Table | Purpose |
|---|---|
| `tickets` | Ticket queue scoped to one project |
| `blocklist` | Blocklist patterns scoped to one project |
| `readiness_scans` | Scan results scoped to one project |

### `project` table changes

The table already supports multiple rows (`getCurrentProject` uses `ORDER BY connected_at DESC LIMIT 1`). Changes:

- `clearProject()` becomes `deleteProject(id)` — targets one row, cascades to its tickets/blocklist/scans/clone directory
- No new columns needed

### `users` table changes

New columns:
- `is_admin BOOLEAN NOT NULL DEFAULT 0` — first registered user gets `1`
- `must_change_password BOOLEAN NOT NULL DEFAULT 1` — flipped to `0` after first password change

### Cascade semantics

Deleting a project (`DELETE /api/projects/:id`):
1. Deletes all tickets, blocklist entries, and readiness scans for that project (via FK cascade or explicit queries)
2. Removes the cloned repo directory (`data/repos/:projectId`)
3. Deletes the project row itself

Credentials survive project deletion — they're instance-wide.

### Migration plan

One new migration file (version 0012):

1. Add `project_id TEXT` (nullable) to `tickets`, `blocklist`, `readiness_scans`
2. Add `is_admin INTEGER NOT NULL DEFAULT 0` and `must_change_password INTEGER NOT NULL DEFAULT 0` to `users`
3. If a project row exists, backfill `project_id` on all existing rows to that project's ID
4. If no project row exists but `instance_settings.repo_path` exists, create a default project from it and backfill
5. Make `project_id` NOT NULL on all three tables (this requires the backfill to be 100% before the ALTER)
6. Set existing user's `is_admin = 1` and `must_change_password = 0`
7. Drop the `instance_settings` table — its `repo_path` column was superseded by the `project` table, and `first_run_completed_at` is superseded by the admin-first setup flow. Nothing reads from either column anymore.

## API Routes

### Project-scoped routes (new URL shape)

All under `/api/projects/:projectId`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/tickets` | List tickets for this project |
| POST | `/tickets` | Create a ticket |
| PUT | `/tickets/:key` | Update a ticket |
| DELETE | `/tickets/:key` | Delete a ticket |
| POST | `/tickets/pull` | Pull tickets from connected Jira |
| GET | `/scans` | List readiness scans |
| POST | `/scans` | Trigger a new scan |
| POST | `/tickets/:key/run` | Run pipeline on a ticket |
| POST | `/tickets/:key/stop` | Stop a running pipeline |
| GET | `/tickets/:key/stream` | SSE stream for run progress |
| GET | `/tickets/:key/transcript` | Read full transcript |
| GET | `/blocklist` | List blocklist entries |
| POST | `/blocklist` | Add a blocklist entry |
| DELETE | `/blocklist/:id` | Remove a blocklist entry |

### Instance-wide routes (no project context)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | List all connected projects |
| GET | `/api/projects/:id` | Get one project by ID |
| POST | `/api/projects/connect` | Connect a new project (provider, owner, repoSlug, defaultBranch) |
| DELETE | `/api/projects/:id` | Delete a project and all its data |
| POST | `/api/projects/:id/sync` | Git pull the project's clone |
| GET | `/api/projects/orgs?provider=` | List orgs for OAuth-connected provider |
| GET | `/api/projects/repos?provider=&org=` | List repos |
| GET/POST | `/api/auth/*` | Authentication (unchanged) |
| POST | `/api/auth/change-password` | Change own password (new) |
| GET | `/api/users` | Admin: list users (new) |
| POST | `/api/users` | Admin: create user (new) |
| DELETE | `/api/users/:id` | Admin: remove user (new) |
| POST | `/api/users/:id/reset-password` | Admin: force-reset user password (new) |
| GET/POST/DELETE | `/api/integrations/*` | Instance-wide credential management (unchanged) |
| GET | `/api/integrations/:provider/callback` | OAuth callbacks (unchanged) |
| POST | `/api/purge` | Destructive instance-wide reset (unchanged) |

### Auth middleware

Stays the same — `authenticateRequest(db, req)` returns `{ userId }` or null. The middleware doesn't know about projects. Each project-scoped handler parses `params.projectId` and validates the project exists and is ready before operating.

### Helper

```ts
function requireProject(db: Database.Database, projectId: string): Project {
  const project = getById(db, projectId);
  if (!project || project.cloneStatus !== "ready") {
    throw new ProjectNotFoundError(projectId);
  }
  return project;
}
```

### Route registration structure

The existing `Router` with `:param` segments handles project nesting naturally. Each project-scoped route module registers its routes under a prefix:

```ts
// In registerTicketRoutes:
const prefix = "/api/projects/:projectId";
router.get(`${prefix}/tickets`, handler);
router.post(`${prefix}/tickets`, handler);
// etc.
```

The `:projectId` param is available in every handler's `params` object and validated by `requireProject`.

## Authentication & User Management

### Registration flow

1. If no admin user exists (`SELECT COUNT(*) FROM users WHERE is_admin = 1` returns 0), the `/api/auth/register` endpoint is publicly accessible — this is the initial setup gate
2. The first registrant gets `is_admin = 1` automatically
3. Once an admin exists, `/api/auth/register` becomes admin-only — regular users can't self-register

### Admin creates users

- `POST /api/users` — admin provides `username` and `password`. User is created with `must_change_password = 1`
- No email flow, no invite links — immediate account creation
- Admin communicates credentials to the new user out-of-band

### Password management

- `POST /api/auth/change-password` — any authenticated user, requires `{ currentPassword, newPassword }`. Verifies current password before updating. Sets `must_change_password = 0`
- `POST /api/users/:id/reset-password` — admin sets a new password for any user. Sets `must_change_password = 1`. Next login prompts for change

### Login gate for password change

After successful login, if `must_change_password` is true, the `/api/auth/me` response includes `mustChangePassword: true`. The frontend redirects to a password change screen before allowing access to the rest of the app.

### Flat permissions model

- **Admin** (`is_admin = 1`): can create/delete users, reset passwords, connect/delete projects
- **Everyone** (including admin): can view and operate on any project (view tickets, trigger scans, run pipeline, manage blocklist)
- No per-project access control — all users see and can modify all projects
- Sessions are project-agnostic (no active-project binding)

## Frontend

### Navigation

```
App shell
├── [Project Switcher dropdown]     (top bar, always visible)
├── /projects/:id                  (project overview — readiness, recommendations, scan trigger)
│   ├── /projects/:id/tickets      (ticket list/board/detail/run)
│   └── /projects/:id/settings     (project settings — sync, disconnect)
└── /settings                      (instance settings)
    ├── /settings/profile          (change password — all users)
    ├── /settings/users            (user management — admin only)
    └── /settings/integrations     (OAuth connect — GitHub, Bitbucket, Jira)
```

### Project switcher

A dropdown in the top navigation bar listing all connected projects by `owner/repoSlug`. States:

- **Ready** — normal, clickable, navigates to `/projects/:id`
- **Cloning** — greyed out with spinner icon
- **Failed** — red text, tooltip with error on hover

A "+ Connect project" action at the bottom opens the existing provider → org → repo flow. After connection completes, navigate to the new project's overview.

### API client wrapper

A thin factory that scopes calls to a project:

```ts
function projectApi(projectId: string) {
  return {
    tickets: {
      list: () => fetch(`/api/projects/${projectId}/tickets`),
      create: (body: Record<string, unknown>) =>
        fetch(`/api/projects/${projectId}/tickets`, { method: "POST", body: JSON.stringify(body) }),
      // ...
    },
    scans: { /* ... */ },
    blocklist: { /* ... */ },
  };
}
```

### Unchanged components

- Transcript viewer, run detail, quick-win resolution — functionally identical, just project-scoped
- 4-second polling for ticket status — unchanged
- SSE stream for run progress — unchanged, URL is now project-scoped

## Implementation Plan Outline

The work breaks down into independent layers:

1. **Database migration** — new columns, backfill, cascade logic
2. **Data access layer** — update `db/*.ts` modules to accept `projectId`
3. **Router + routes** — reorganize under `/api/projects/:projectId`, add user CRUD
4. **Auth changes** — admin flag, password change/reset, must-change-password gate
5. **Frontend** — project switcher, navigation restructuring, API client update
6. **Pipeline integration** — ensure ticket-runner, scanner, clone logic work with project-scoped data

### Out of scope (explicitly deferred)

- Concurrent pipeline execution across multiple projects
- Per-project access control (RBAC)
- Email-based invite flow
- Two-way ticket tracker integration (Phase 2 roadmap item)
- Scheduled/periodic re-scanning (Phase 2 roadmap item)

## Risks & Edge Cases

- **Migration backfill race**: If a production instance has tickets/blocklist/scans but no project row (pre-project-era), the migration creates a synthetic project from `instance_settings.repo_path`. If that path is gone, backfill fails — migration must handle this gracefully (skip backfill, leave old rows orphaned — they'll be invisible to the new API anyway).
- **Pipeline running during project delete**: If a ticket run is in progress when the project is deleted, the worktree cleanup could race with the agent process. Mitigation: disallow project deletion while a run is active (`status = 'running'` for any ticket in that project).
- **Clone directory naming**: Currently `data/repos/:projectId`. With N projects this is fine — the directory name is stable and IDs are UUIDs. No collision risk.
- **Router param extraction**: The existing `Router` extracts `:param` values from URL segments. Ensure `projectId` is always a valid UUID before passing to DB queries (injection guard — already handled by parameterized queries, but belt-and-suspenders on input shape).
