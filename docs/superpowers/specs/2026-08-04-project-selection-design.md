# Project Selection via GitHub/Bitbucket — Design

Written 4 August 2026. First of two specs closing the roadmap's "VCS abstraction" gap — this one covers the Settings entry point (connect a provider, pick a repo, get a managed local clone). The second spec (not yet written) covers making Open PR real (commit → push → create PR).

## Problem

Settings → Project today is a free-text field where the user types an absolute local filesystem path to an existing git checkout (`validateRepoPath` in `src/http-utils.ts` just checks it exists and has a `.git` dir). This only works for the person running the server locally — it's not a flow a real user can go through. It also has no concept of which VCS provider hosts the repo, which blocks Open PR from ever calling a real API.

## Goal

Replace the manual path field with a Vercel-style "Import Project" flow, embedded in the existing Settings page's Project card:

1. Pick a provider (GitHub or Bitbucket).
2. OAuth-connect that provider (or reuse an existing connection from Integrations — same token, shared).
3. Pick an org/workspace, then search a paginated repo list within it.
4. Server clones the chosen repo into a managed directory; user never sees or enters a filesystem path.

Once done, local-path entry is fully removed from the UI. Multi-project is out of scope (still one project per instance) but the schema is shaped so multi-project later is additive, not a rework.

## Data model

New `project` table (migration `0008_project_provider.ts`). Unlike `instance_settings` (which has a `CHECK (id = 1)` constraint baking singleton-ness into the schema), `project.id` is just a UUID primary key with no such constraint — today the app only ever creates one row and treats "the row" as "the current project," but nothing in the schema enforces that, so a future multi-project change only needs to change queries (e.g. add a `WHERE user_id = ?` or similar), not migrate the table shape.

```sql
CREATE TABLE project (
  id TEXT PRIMARY KEY,              -- UUID; also the clone directory name
  provider TEXT NOT NULL,           -- 'github' | 'bitbucket'
  owner TEXT NOT NULL,              -- org/workspace/user slug
  repo_slug TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  clone_status TEXT NOT NULL,       -- 'cloning' | 'ready' | 'failed'
  clone_error TEXT,                 -- set only when clone_status = 'failed'
  connected_at TEXT NOT NULL
);
```

"The current project" is queried as `SELECT * FROM project ORDER BY connected_at DESC LIMIT 1` — with `clear` deleting the row before any new `connect`, there's only ever zero or one row in practice, but the query itself doesn't assume that, so it degrades gracefully (picks the most recent) rather than erroring if that assumption is ever violated.

Same migration drops `repo_path` and `first_run_completed_at` from `instance_settings` (native `ALTER TABLE ... DROP COLUMN`, supported by the project's SQLite version) — that table goes back to being purely instance-wide settings, not project state.

OAuth tokens keep living in the existing `credentials` table under `oauth:<provider>` keys (`upsertCredential`/`getOAuthToken` in `src/pipeline/oauth-integrations.ts`) — same mechanism Jira and Bitbucket already use. **One connection per provider, shared between Settings and Integrations** — connecting GitHub from either surface satisfies both.

## Storage layout

Clone directory: `${REPOS_DIR}/<project.id>`, where `REPOS_DIR` defaults to `data/repos` and is overridable via env var — same convention as the existing `DB_PATH` (`process.env.DB_PATH ?? "data/instance.sqlite"`). The directory name is an opaque UUID, not `owner/repo`, so renames upstream or future multi-project rows never collide or need renaming.

The resulting local path is **never surfaced in the UI** — it's purely a server-side implementation detail. Debugging a broken clone means inspecting the DB/filesystem directly, not reading it off a settings screen.

## Backend

### GitHub OAuth (new)

Doesn't exist in this codebase today (only Jira and Bitbucket do). Added to `oauth-integrations.ts` / `routes/oauth.ts` following the exact same shape as the existing Bitbucket flow: `startGithubAuth`, `handleGithubCallback`, scope `repo` (need private-repo read + later push access — most real automation targets are private).

### Routes

- `GET /api/projects/orgs` — list orgs/workspaces (+ the personal account) visible to the connected provider's token.
- `GET /api/projects/repos?org=<slug>&page=<n>&q=<search>` — paginated (provider-native pagination, not fetch-all-upfront), filterable by name within the given org/workspace scope.
- `POST /api/projects/connect` — body `{ provider, owner, repoSlug, defaultBranch }`. Creates the `project` row with `clone_status: 'cloning'`, kicks off an async clone (embeds the stored OAuth token directly into the HTTPS clone URL — `https://x-access-token:<token>@github.com/owner/repo.git` for GitHub, provider-equivalent for Bitbucket), returns immediately (fire-and-forget, same shape as `POST /api/scans/run`).
- `GET /api/projects/current` — returns the current project row (or `null`) including `clone_status`/`clone_error`, for polling. Replaces `GET /api/settings/project`, which is removed.
- `POST /api/projects/sync` — replaces `POST /api/settings/sync`, which is removed. Same behavior (`git pull` in the clone directory), just reading the path from the `project` row instead of `instance_settings.repo_path`.
- `POST /api/projects/clear` — required before connecting a different repo (see below). Hard-deletes all tickets, blocklist entries, and readiness scans, removes the clone directory, deletes the `project` row. Does **not** touch stored OAuth tokens.

### Migrating existing `repoPath` consumers

Every current reader of `getInstanceSettings(db).repoPath` switches to a new `getCurrentProject(db)` helper (`src/db/project.ts`) returning the clone path (`join(REPOS_DIR, project.id)`) when `clone_status === 'ready'`, or `null` otherwise:

- `src/pipeline/ticket-runner.ts` — `repoPath` param source for Judge/Implement/Verify worktree creation.
- `src/scanner/agent-pass.ts`, `src/scanner/mechanical.ts`, `src/scanner/run-scan.ts` — repo path for the readiness scan's mechanical pass and throwaway agent-pass worktree.
- `src/routes/scans.ts`, `src/routes/ticket-run.ts` — both currently call `getInstanceSettings(db)` to check `settings.repoPath` before allowing a scan/run to start; switch to `getCurrentProject(db)` and its `ready` check.
- Frontend: `web/src/hooks/useProjectSettings.ts` is replaced by a `useProject` hook wrapping the new `/api/projects/*` routes; `web/src/App.tsx`'s `hasProject` check (gates the scan button, the "no project configured" banner) switches from `!!repoPath` to `project?.cloneStatus === 'ready'`.

### Clone failure handling

On clone failure, the `project` row is deleted automatically (not left around as a retryable "failed" row) and the clone directory (if partially created) is removed. The frontend, on seeing a failure via polling, drops back to the repo list (same org/scope) so the user re-picks — possibly the same repo — as a fresh `connect` call. No separate retry endpoint.

### Changing projects

Switching to a different repo while one is already connected requires an explicit `POST /api/projects/clear` first — never implicit/automatic. The UI gates this behind a confirmation dialog naming what will be deleted (ticket/blocklist/scan counts). This is a deliberate simplification for the current single-project-per-instance phase; multi-project later removes the need for "clear before switching" entirely.

### Disconnecting a provider

Disconnecting OAuth (from Settings or Integrations — same shared connection) only removes the stored token. It does **not** cascade into clearing the project, clone, or tickets — those stay intact and the pipeline can keep running against the existing clone. Anything that needs the token (repo list, clone, future PR creation, and Sync's `git pull` if the remote requires auth) surfaces a simple inline "Reconnect `<provider>`" prompt instead of a generic error. This same reconnect-prompt behavior also covers token expiry (see Known Gaps) — there's no special-cased "expired" vs. "disconnected" handling, both just mean "the stored token doesn't work right now."

## Frontend (Settings → Project card)

- **Unconnected:** provider picker (GitHub / Bitbucket) → OAuth redirect (reuses Integrations' connect endpoints) → back on Settings → org/workspace dropdown → searchable paginated repo list (load-more, not infinite-fetch-all) → pick a repo.
- **Cloning:** optimistic "Setting up project…" state immediately on pick, then polls `GET /api/projects/current` until `clone_status` leaves `cloning`.
- **Failed:** inline error message, "Back to repos" button returns to the list at the same org/scope (failed project row already auto-cleared server-side).
- **Connected (collapsed):** compact summary — provider icon, `owner/repo-slug`, default branch. Two actions:
  - **Change project** → confirmation dialog (names what will be deleted) → `clear` → drops back into the picker flow.
  - **Disconnect provider** → removes only the OAuth token; project/clone/tickets stay as-is; card shows a "Reconnect" affordance for anything that needs the token.

## Known gaps (explicitly out of scope for this spec)

- **Bitbucket token refresh:** tokens are currently stored with a 1-hour `expiresAt` and a `refreshToken` that's never used (`src/pipeline/oauth-integrations.ts`) — no refresh-before-expiry or refresh-on-401 logic exists. Until a follow-up implements it, Bitbucket users will hit the "Reconnect" prompt roughly hourly. GitHub OAuth App tokens don't expire, so this only affects Bitbucket.
- **Real Open PR:** this spec only gets a real clone onto disk with provider/owner/repo metadata recorded. Implement/Verify still don't commit, and Open PR still fabricates a fake PR URL — that's the second spec.
- **Multi-project:** schema uses opaque UUIDs specifically so this is additive later, but UI/API remain single-project (singleton `project` row) for now.

## Testing

Same conventions as the rest of `src/`: `node --test`-based unit tests for DB helpers (`src/db/project.test.ts`) and route handlers (`src/routes/projects.test.ts`) using an in-memory/tmpdir SQLite instance, no network calls — provider API calls (org list, repo list, clone) get a fake/injectable client in tests, mirroring how `run-scan.test.ts` injects a fake invoker rather than calling a real agent.
