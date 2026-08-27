# SANDWICH v2 — Roadmap

Collaboration roadmap for SANDWICH v2 — from a messy brief to an execution-ready spec. See [`PRODUCT.md`](./PRODUCT.md) for product intent and [`README.md`](./README.md) for setup.

> **Generated file — do not edit by hand.** Source of truth: [`registry/roadmap.json`](./registry/roadmap.json). Regenerate with `npm run roadmap:generate`.

This roadmap is **forward-looking**: it lists only work we intend to do. When an item ships, it is deleted from the registry — git history keeps the record.

**Status:** ⚪ Planned · 🔵 In progress · 🔴 Blocked

## At a glance

| ID | Item | Milestone | Status | Owner |
| --- | --- | --- | --- | --- |
| M1-01 | `projects` table + repository | Project entity & storage foundation | ⚪ Planned | unassigned |
| M1-02 | Attach conversations to a project; auto-create on first chat | Project entity & storage foundation | ⚪ Planned | unassigned |
| M1-03 | Project directory manager + path guard | Project entity & storage foundation | ⚪ Planned | unassigned |
| M1-04 | Railway Volume provisioning + single-instance constraint | Project entity & storage foundation | ⚪ Planned | unassigned |
| M1-05 | Retire `document_versions` / `document_files`; slim `documents` to an index | Project entity & storage foundation | ⚪ Planned | unassigned |
| M2-01 | Run all engines with `cwd = project dir` + tools | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M2-02 | `BRIEF.md` builder | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M2-03 | Text deliverables written as files in the project | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M2-04 | Prototype → single `prototype/index.html` | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M2-05 | Persist the Pi session per conversation | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M2-06 | Serialize generation runs per project | Pi SDK on the project workspace | ⚪ Planned | unassigned |
| M3-01 | Commit per generation | Versioning via git | ⚪ Planned | unassigned |
| M3-02 | Rollback via git | Versioning via git | ⚪ Planned | unassigned |
| M3-03 | Version history + diff API | Versioning via git | ⚪ Planned | unassigned |
| M4-01 | `/p` preview served from disk | Preview & retrieval from the filesystem | ⚪ Planned | unassigned |
| M4-02 | Document read / download from disk | Preview & retrieval from the filesystem | ⚪ Planned | unassigned |
| M4-03 | Project file-tree API for the sidebar | Preview & retrieval from the filesystem | ⚪ Planned | unassigned |
| M5-01 | R2 backup per project | Durability & lifecycle | ⚪ Planned | unassigned |
| M5-02 | Lazy-restore a project from R2 | Durability & lifecycle | ⚪ Planned | unassigned |
| M5-03 | Project deletion | Durability & lifecycle | ⚪ Planned | unassigned |
| M5-04 | Per-user disk guardrails | Durability & lifecycle | ⚪ Planned | unassigned |

---

## M1 — Project entity & storage foundation

**Goal:** Introduce a first-class `projects` entity and a persistent per-project directory on disk that becomes the source of truth for every generated artifact. Postgres keeps only an index.

### M1-01 · `projects` table + repository

**Status:** ⚪ Planned  |  **Owner:** unassigned

Add a `projects` table (id, user_id, title, created_at, updated_at) with a Drizzle repo for create / list / get / rename / delete, every call scoped to the owning user. One project owns many conversations and many documents.

**Why:** Today conversations attach straight to the user with no grouping. Everything else in this plan — the on-disk directory, git versioning, shared deliverables — hangs off a project entity that does not exist yet.

**Acceptance criteria:**
- [ ] `projects` table + migration created
- [ ] Repo functions: createProject, listProjects(userId), getProject, renameProject, deleteProject — all user-scoped
- [ ] Ownership checks covered by unit tests

**Notes:** Mirror the style of `apps/server/db/conversations.ts`. Keep `id` as text `gen_random_uuid()` like conversations.

### M1-02 · Attach conversations to a project; auto-create on first chat

**Status:** ⚪ Planned  |  **Owner:** unassigned

Add a `project_id` FK on `conversations`. When a user starts a conversation without naming a project, create a fresh project (title seeded from the first prompt / conversation title, renameable later) and attach the conversation. When they pick an existing project, attach to that one.

**Why:** The product intent is that the first chat transparently spins up a project directory; subsequent chats either continue in that project or open a new one. 1 project : many conversations.

**Acceptance criteria:**
- [ ] `conversations.project_id` column + FK
- [ ] New-conversation route accepts an optional `projectId`; absent → a new project is created and returned
- [ ] Project title editable via renameProject
- [ ] Conversation listing can be grouped by project

**Notes:** Touches `createConversation` in `apps/server/db/conversations.ts` and `apps/server/routes/conversations.ts`. Fold the existing `conversation_documents` link into `documents.conversation_id` (see M1-05).

### M1-03 · Project directory manager + path guard

**Status:** ⚪ Planned  |  **Owner:** unassigned

A module that resolves and creates `${PROJECTS_ROOT}/${userId}/${projectId}`, runs `git init` (with an initial empty commit) on first creation, and exposes `resolveInsideProject(projectId, relPath)` that rejects any path escaping the project root.

**Why:** Single choke point for all filesystem access so engines and preview routes can never read or write outside one project. This is where the "sebisanya jangan keluar project directory" isolation guard lives.

**Acceptance criteria:**
- [ ] `getProjectDir(userId, projectId)` creates the dir + `git init` + initial commit if absent
- [ ] `resolveInsideProject` throws on `..`, absolute paths, and symlink escape
- [ ] `PROJECTS_ROOT` env var (default `/data/projects`; dev fallback under the repo, git-ignored)
- [ ] Path-guard unit tests

**Notes:** New file, e.g. `apps/server/projects/workspace.ts`. Use `git` via `child_process`, not a heavy dependency.

### M1-04 · Railway Volume provisioning + single-instance constraint

**Status:** ⚪ Planned  |  **Owner:** unassigned

Mount a Railway Volume at `/data`, set `PROJECTS_ROOT=/data/projects`, and document that the API service now runs as a single instance (no horizontal scaling) because the volume is single-attach.

**Why:** The filesystem is now canonical for artifacts, so it must survive redeploys. Railway container disk is ephemeral; a Volume is the persistent option.

**Acceptance criteria:**
- [ ] Volume mounted and `PROJECTS_ROOT` set in Railway
- [ ] Boot check logs a clear fatal error if `PROJECTS_ROOT` is missing or not writable
- [ ] README.md / PRODUCT.md updated with the single-instance constraint

**Notes:** The existing Redis in-flight coordination stays as a safety net but is no longer load-bearing.

### M1-05 · Retire `document_versions` / `document_files`; slim `documents` to an index

**Status:** ⚪ Planned  |  **Owner:** unassigned

Drop both tables. Reshape `documents` to: id, project_id, conversation_id (nullable — "generated in"), type, title, relative_path, last_commit_sha, timestamps. No migration of existing rows — clean slate.

**Why:** Git in the project directory becomes the version store. Postgres only needs a pointer to the file on disk and the latest commit SHA.

**Acceptance criteria:**
- [ ] Migration drops `document_versions` and `document_files` and alters `documents`
- [ ] `apps/server/db/documents.ts` rewritten to the new shape
- [ ] All code paths that read versions/files updated or removed (`prototype/engine.ts`, `prototype/routes.ts`, `routes/documents.ts`, `routes/conversation-run.ts`)
- [ ] `conversation_documents` removed in favour of `documents.conversation_id`

**Notes:** This is a breaking schema change; coordinate with M2 and M4 so nothing reads the dropped tables after the migration.

## M2 — Pi SDK on the project workspace

**Goal:** Every engine runs like Pi / Claude Code in a local checkout: `cwd` is the project directory, context comes from the files there, and output is written back as files.

### M2-01 · Run all engines with `cwd = project dir` + tools

**Status:** ⚪ Planned  |  **Owner:** unassigned

Replace the ephemeral `tmpdir()` workspace (prototype engine) and `process.cwd()` (text engine) with the resolved project directory. Give every engine the tool set read / write / edit / ls / grep / find / bash. Keep the existing timeout guards.

**Why:** Unifies the two engines and lets a later pass (e.g. quotation) read a deliverable the user already generated in the same project — exactly how a local coding agent works.

**Acceptance criteria:**
- [ ] `runTextGeneration` and `generatePrototypeDocument` both take `projectDir` and pass it as `cwd`
- [ ] Text engine is no longer tool-free
- [ ] PRODUCT.md §6 ("text engine stays tool-free") updated

**Notes:** Watch for the historical text-engine hangs with tools (PRODUCT.md §6). If they recur, add a tool-call ceiling and/or a stricter timeout rather than reverting.

### M2-02 · `BRIEF.md` builder

**Status:** ⚪ Planned  |  **Owner:** unassigned

Before each run the backend (re)writes `BRIEF.md` at the project root: the consolidated brief, clarifying Q&A, and short summaries of any uploaded attachments. This is the only user-originated context that lands on disk.

**Why:** Gives every engine grounding without dumping raw chat logs or raw uploads into `cwd`, which would be context noise the agent picks up via `ls` / `read`.

**Acceptance criteria:**
- [ ] `BRIEF.md` regenerated on each generate run and committed with that run
- [ ] Chat transcript, intake, and pipeline/session state stay in Postgres
- [ ] Raw attachment bytes stay in R2; only extracted-text summaries go into `BRIEF.md`

**Notes:** Replaces the current inline attachment injection (`enrichMessageContent`) for large attachments; small ones can still be inlined into the prompt.

### M2-03 · Text deliverables written as files in the project

**Status:** ⚪ Planned  |  **Owner:** unassigned

PRD / quotation / specs / MOM land as `prd.md`, `quotation.md`, `spec.md`, `mom.md` at the project root, produced by the agent via the `write` tool. The backend records/updates the `documents` index row and commits.

**Why:** "Layaknya codebase" — one file per deliverable, overwrite on regenerate, history in git.

**Acceptance criteria:**
- [ ] Each deliverable type maps to a fixed filename at the project root
- [ ] Regenerate overwrites the same file (new commit, not a new file)
- [ ] `documents.relative_path` and `last_commit_sha` updated after each run

**Notes:** One deliverable of each type per project for now.

### M2-04 · Prototype → single `prototype/index.html`

**Status:** ⚪ Planned  |  **Owner:** unassigned

Prototype output becomes a single self-contained `prototype/index.html` inside the project directory. Drop the multi-file save-to-Postgres loop and the tmpdir workspace. Refine edits the file in place.

**Why:** The user wants single-HTML prototypes for now; the multi-file model and its Postgres persistence go away with `document_files`.

**Acceptance criteria:**
- [ ] Prototype run writes/edits only `prototype/index.html`
- [ ] Refine edits the existing file in place, not a regenerate
- [ ] Decision recorded on whether the glowup polish pass still runs (in place) or is deferred

**Notes:** `apps/server/prototype/engine.ts`, `apps/server/prototype/glowup.ts`.

### M2-05 · Persist the Pi session per conversation

**Status:** ⚪ Planned  |  **Owner:** unassigned

Swap `SessionManager.inMemory` for a disk-backed session keyed by `conversation_id`, stored OUTSIDE the project directory (e.g. `${PI_SESSIONS_ROOT}/${conversationId}`). One project can have several conversations, hence several sessions, all sharing the same `cwd`.

**Why:** Matches "session per conversation, context from the folder": the agent keeps conversational continuity while the project files are the shared substrate.

**Acceptance criteria:**
- [ ] Session store path is outside `cwd` — no session files pollute the project directory
- [ ] Resuming a conversation resumes its Pi session
- [ ] Deleting a conversation removes its session store

**Notes:** Check whether `pi.SessionManager` ships a disk-backed manager; otherwise wrap one.

### M2-06 · Serialize generation runs per project

**Status:** ⚪ Planned  |  **Owner:** unassigned

Extend the in-flight guard from per-conversation to also lock the project directory, so two conversations in the same project cannot run generations concurrently against the same git working tree.

**Why:** Concurrent writes and commits to one git repo corrupt its state.

**Acceptance criteria:**
- [ ] A second concurrent run in the same project queues or is rejected with a clear message
- [ ] The lock is released on completion, error, and timeout

**Notes:** `inFlight` map in `apps/server/routes/conversation-run.ts` plus the Redis keys in `apps/server/redis.ts`.

## M3 — Versioning via git

**Goal:** Replace the Postgres version snapshots with git operations on each project repository.

### M3-01 · Commit per generation

**Status:** ⚪ Planned  |  **Owner:** unassigned

After every successful generate / refine, stage the changed deliverable(s) + `BRIEF.md` and commit with a structured message (deliverable type + version, conversation id, prompt summary). Persist the resulting SHA to `documents.last_commit_sha`.

**Why:** The git log becomes the version history that the sidebar and rollback read from.

**Acceptance criteria:**
- [ ] Exactly one commit per successful run, app-authored, with metadata in the body
- [ ] `last_commit_sha` updated on the affected `documents` rows
- [ ] An empty diff produces no commit and a "nothing changed" reply

**Notes:** Commit via `child_process` inside the workspace module from M1-03.

### M3-02 · Rollback via git

**Status:** ⚪ Planned  |  **Owner:** unassigned

Rewire the existing rollback-intent parsing (`apps/server/prototype/rollback.ts`) to git: "rollback ke v2" resolves the Nth deliverable commit and restores that file, then commits the restore.

**Why:** The rollback UX already exists in chat; only the backing store changes.

**Acceptance criteria:**
- [ ] "rollback", "kembali ke versi sebelumnya", "v2" all resolve to git operations
- [ ] Rollback creates a new commit — no history rewrite
- [ ] Preview reflects the rolled-back file

**Notes:** Operate per deliverable file, not the whole tree.

### M3-03 · Version history + diff API

**Status:** ⚪ Planned  |  **Owner:** unassigned

Endpoints that return the `git log` for a deliverable (SHA, date, message, prompt summary) and a unified diff between two SHAs, for the sidebar version panel.

**Why:** PRODUCT.md §7 promises version history and per-prompt diffs in the sidebar.

**Acceptance criteria:**
- [ ] `GET /api/projects/:id/documents/:type/history`
- [ ] `GET /api/projects/:id/documents/:type/diff?from=&to=` returns unified diff text
- [ ] Both guarded by project ownership

## M4 — Preview & retrieval from the filesystem

**Goal:** Serve prototype previews and document content from disk (and from past commits) instead of Postgres.

### M4-01 · `/p` preview served from disk

**Status:** ⚪ Planned  |  **Owner:** unassigned

`/p/:projectId/` serves `prototype/index.html` from the project directory; `/p/:projectId/v/:sha/` serves that file at a past commit via `git show`. Keep the auth check.

**Why:** `document_files` is gone; the preview must read the on-disk file.

**Acceptance criteria:**
- [ ] Latest and versioned preview both work from disk
- [ ] 404 when no prototype file exists for the project
- [ ] `prototypePreviewUrl` updated from `/p/:docId` to `/p/:projectId`

**Notes:** `apps/server/prototype/routes.ts`.

### M4-02 · Document read / download from disk

**Status:** ⚪ Planned  |  **Owner:** unassigned

Document content endpoints in `apps/server/routes/documents.ts` read the file from the project directory (optionally at a given SHA) instead of `document_versions`.

**Why:** Same reason — the version tables no longer exist.

**Acceptance criteria:**
- [ ] Get latest content, get content at a SHA, and download (.md / .html) all work
- [ ] Every read goes through `resolveInsideProject`

### M4-03 · Project file-tree API for the sidebar

**Status:** ⚪ Planned  |  **Owner:** unassigned

`GET /api/projects/:id/files` returns the deliverables present on disk (type, filename, last commit, updated-at) to power the document panel.

**Why:** The sidebar now reflects a directory, not a set of `documents` rows with embedded content.

**Acceptance criteria:**
- [ ] Lists the known deliverables that exist on disk
- [ ] `BRIEF.md`, `.git`, and any internal files are excluded or flagged internal

## M5 — Durability & lifecycle

**Goal:** Back the single-copy volume with R2, and handle project deletion and storage limits.

### M5-01 · R2 backup per project

**Status:** ⚪ Planned  |  **Owner:** unassigned

After each commit, asynchronously push a `git bundle` of the project repo to R2 under `projects/:userId/:projectId.bundle`.

**Why:** The Railway Volume is a single copy. R2 is the durability net and the escape hatch if we later change hosts or need to scale out.

**Acceptance criteria:**
- [ ] Bundle uploaded after each commit, non-blocking, retried on failure
- [ ] Backup failures are logged and surfaced in metrics, never to the user

**Notes:** Reuse `apps/server/storage/r2.ts`.

### M5-02 · Lazy-restore a project from R2

**Status:** ⚪ Planned  |  **Owner:** unassigned

When a project directory is requested but missing on disk (volume recreated, new host), restore it from its R2 bundle before use.

**Why:** Makes the volume disposable and keeps redeploys safe even if the volume is wiped.

**Acceptance criteria:**
- [ ] Missing dir + existing bundle → cloned from the bundle transparently
- [ ] Missing dir + no bundle → treated as a new empty project
- [ ] Restore is idempotent and locked per project

### M5-03 · Project deletion

**Status:** ⚪ Planned  |  **Owner:** unassigned

Deleting a project removes its DB rows (conversations, documents, chat_messages, attachment metadata), its on-disk directory, its R2 bundle, and its R2 attachment objects. Deleting a single conversation removes only that conversation + its Pi session, never the project.

**Why:** No orphaned disk or object storage.

**Acceptance criteria:**
- [ ] DB rows removed in one transaction; disk + R2 cleanup best-effort with logging
- [ ] Deleting a conversation leaves the project and its other conversations intact

**Notes:** Extend the `deleteConversation` transaction pattern in `apps/server/db/conversations.ts`.

### M5-04 · Per-user disk guardrails

**Status:** ⚪ Planned  |  **Owner:** unassigned

Cap total project bytes per user (and per project), with a clear error when exceeded. Keep the existing monthly document / chat quotas.

**Why:** Filesystem storage per user is now effectively unbounded.

**Acceptance criteria:**
- [ ] Size check before a generate run writes files
- [ ] Limits configurable per plan (Starter vs Pro)
- [ ] Over-limit returns 403 with an actionable message

**Notes:** PRODUCT.md §9.

---

## How to update

1. Edit [`registry/roadmap.json`](./registry/roadmap.json) — **never edit this file directly.**
2. Run `npm run roadmap:generate` to rebuild `ROADMAP.md`.
3. Commit `registry/roadmap.json` and `ROADMAP.md` together.

**Adding an item:** give it an id `<milestone>-<n>` (e.g. `M2-04`), a `title`, a plain-language `what`, and `status: "planned"`.

**Finishing an item:** delete its entry from the registry and regenerate. This roadmap never shows completed work.

_Last generated: 2026-08-27_
