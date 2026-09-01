# Backend Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the `apps/server` backend from a mixed flat-routes + catch-all-pipeline layout into feature folders, and split the 1,098-line `conversation-run.ts` god file into focused modules.

**Architecture:** Each feature domain owns a folder with its route handler(s), business logic, and (if needed) a thin `db.ts` re-export. The `routes/` directory is deleted; its files redistribute into domain folders. `pipeline/` is deleted; its files redistribute by concern. `engine/` is deleted; its files move to `generation/`. No new dependencies. No behaviour changes — this is a pure refactor.

**Tech Stack:** Node.js, TypeScript, Drizzle ORM, custom `Router` class (unchanged).

**Spec:** `docs/superpowers/specs/` — no separate spec; design was approved in conversation.

## Global Constraints

- Zero behaviour changes — all existing API routes keep identical paths and response shapes.
- No new npm dependencies.
- TypeScript must compile cleanly after each task (`pnpm tsc --noEmit` from repo root).
- Run existing tests after each task: `pnpm test --filter @sandwich/server` (or equivalent).
- Commit after each task.
- Never touch `apps/web/` — frontend imports nothing from the server directly.

---

## File Map: before → after

| Before | After |
|--------|-------|
| `routes/auth.ts` | `auth/routes.ts` (append to existing auth folder) |
| `routes/password-reset.ts` | `auth/password-reset.ts` |
| `routes/email-verification.ts` | `auth/email-verification.ts` |
| `routes/conversations.ts` | `conversations/routes.ts` |
| `routes/projects.ts` | `projects/routes.ts` |
| `routes/attachments.ts` | `attachments/routes.ts` |
| `routes/usage.ts` | `billing/usage.ts` |
| `routes/subscriptions.ts` | `billing/subscriptions.ts` |
| `routes/midtrans.ts` | `billing/midtrans-routes.ts` |
| `routes/share.ts` | `sharing/routes.ts` |
| `routes/settings.ts` | `account/settings.ts` |
| `routes/preferences.ts` | `account/preferences.ts` |
| `routes/documents.ts` | `documents/routes.ts` |
| `routes/admin.ts` | `admin/routes.ts` |
| `routes/conversation-run.ts` | split — see generation tasks below |
| `pipeline/orchestrate.ts` | `generation/orchestrate.ts` |
| `pipeline/prompts.ts` | `generation/prompts.ts` |
| `pipeline/rate-limit.ts` | `auth/rate-limit.ts` |
| `pipeline/email.ts` | `notifications/email.ts` |
| `pipeline/references.ts` | `notifications/references.ts` |
| `pipeline/normalize-prose.ts` | `documents/normalize-prose.ts` |
| `pipeline/export.ts` | `documents/export.ts` |
| `pipeline/extract.ts` | `attachments/extract.ts` |
| `pipeline/midtrans.ts` | `billing/midtrans.ts` |
| `pipeline/payment-status.ts` | `billing/payment-status.ts` |
| `pipeline/plans.ts` | `billing/plans.ts` |
| `engine/tool-budget.ts` | `generation/budget.ts` |
| `engine/bash-tool.ts` | `generation/bash-tool.ts` |
| `db/conversations.ts` | `conversations/db.ts` |
| `db/documents.ts` | `documents/db.ts` |
| `db/projects.ts` | `projects/db.ts` |

Folders deleted when empty: `routes/`, `pipeline/`, `engine/`.

---

## Task 1: Move `pipeline/` utilities that have no cross-dependencies

These files are standalone — no imports from other pipeline files — so moving them first unblocks everything else.

**Files:**
- Move: `pipeline/rate-limit.ts` → `auth/rate-limit.ts`
- Move: `pipeline/normalize-prose.ts` → `documents/normalize-prose.ts`
- Move: `pipeline/email.ts` → `notifications/email.ts`
- Update: every file that imports from `../pipeline/rate-limit`, `../pipeline/normalize-prose`, `../pipeline/email`

**Interfaces:**
- Produces: `auth/rate-limit.ts` exporting `createRateLimiter`, `clientIp`
- Produces: `documents/normalize-prose.ts` exporting `normalizeProse` (verify exact name)
- Produces: `notifications/email.ts` exporting `sendEmail`

- [ ] **Step 1: Create destination folders**

```bash
mkdir -p apps/server/notifications
mkdir -p apps/server/documents
```

- [ ] **Step 2: Move the three files**

```bash
cp apps/server/pipeline/rate-limit.ts apps/server/auth/rate-limit.ts
cp apps/server/pipeline/normalize-prose.ts apps/server/documents/normalize-prose.ts
cp apps/server/pipeline/email.ts apps/server/notifications/email.ts
```

- [ ] **Step 3: Update internal imports inside each moved file**

Open each moved file. Adjust any relative imports that pointed to sibling pipeline files. For example, if `email.ts` imports from `../pipeline/something`, update to the new path.

Run: `grep -r "from.*pipeline/rate-limit\|from.*pipeline/normalize-prose\|from.*pipeline/email" apps/server --include="*.ts" -l`

For each file returned, update the import path. Common cases:
- `../pipeline/rate-limit` → `../auth/rate-limit` (from routes/) or `./rate-limit` (from auth/)
- `../pipeline/email` → `../notifications/email`
- `../pipeline/normalize-prose` → `../documents/normalize-prose`

- [ ] **Step 4: Verify compile**

```bash
cd /Users/adib/Work/Etalas/sandwich-2
pnpm --filter @sandwich/server exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @sandwich/server test
```

Expected: all pass.

- [ ] **Step 6: Delete originals**

```bash
rm apps/server/pipeline/rate-limit.ts
rm apps/server/pipeline/normalize-prose.ts
rm apps/server/pipeline/email.ts
rm -f apps/server/pipeline/normalize-prose.test.ts  # move test too if it exists
```

If `.test.ts` files exist for each, move them alongside:
```bash
# run first to check
ls apps/server/pipeline/rate-limit.test.ts apps/server/pipeline/email.test.ts 2>/dev/null
```

Move any found tests to match new locations.

- [ ] **Step 7: Commit**

```bash
git add -A apps/server/auth/rate-limit.ts apps/server/documents/normalize-prose.ts apps/server/notifications/email.ts apps/server/pipeline/
git commit -m "refactor: move rate-limit, normalize-prose, email out of pipeline/"
```

---

## Task 2: Move billing files from `pipeline/`

**Files:**
- Move: `pipeline/midtrans.ts` → `billing/midtrans.ts`
- Move: `pipeline/payment-status.ts` → `billing/payment-status.ts`
- Move: `pipeline/plans.ts` → `billing/plans.ts`
- Update all importers

**Interfaces:**
- Produces: `billing/plans.ts` exporting `PLANS` (and any other exports — check with `grep "^export" apps/server/pipeline/plans.ts`)
- Produces: `billing/midtrans.ts` exporting payment helpers
- Produces: `billing/payment-status.ts` exporting payment status helpers

- [ ] **Step 1: Create billing folder**

```bash
mkdir -p apps/server/billing
```

- [ ] **Step 2: Copy files**

```bash
cp apps/server/pipeline/midtrans.ts apps/server/billing/midtrans.ts
cp apps/server/pipeline/payment-status.ts apps/server/billing/payment-status.ts
cp apps/server/pipeline/plans.ts apps/server/billing/plans.ts
```

- [ ] **Step 3: Update internal imports inside moved files**

Check for cross-imports between these three:
```bash
grep -n "from.*pipeline/" apps/server/billing/midtrans.ts apps/server/billing/payment-status.ts apps/server/billing/plans.ts
```
Adjust any found to sibling imports (`./plans`, `./midtrans`, etc.).

- [ ] **Step 4: Update importers across the codebase**

```bash
grep -r "from.*pipeline/midtrans\|from.*pipeline/payment-status\|from.*pipeline/plans" apps/server --include="*.ts" -l
```

For each file, update the import path:
- `../pipeline/plans` → `../billing/plans`
- `../pipeline/midtrans` → `../billing/midtrans`
- `../pipeline/payment-status` → `../billing/payment-status`

- [ ] **Step 5: Compile check**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @sandwich/server test
```

- [ ] **Step 7: Delete originals + commit**

```bash
rm apps/server/pipeline/midtrans.ts apps/server/pipeline/payment-status.ts apps/server/pipeline/plans.ts
# move test files if present
ls apps/server/pipeline/midtrans.test.ts apps/server/pipeline/payment-status.test.ts apps/server/pipeline/plans.test.ts 2>/dev/null
git add -A
git commit -m "refactor: move billing files from pipeline/ to billing/"
```

---

## Task 3: Move references and extract from `pipeline/`

**Files:**
- Move: `pipeline/references.ts` → `notifications/references.ts`
- Move: `pipeline/extract.ts` → `attachments/extract.ts`
- Move: `pipeline/export.ts` → `documents/export.ts`
- Update all importers

- [ ] **Step 1: Create attachments folder (if not exists)**

```bash
mkdir -p apps/server/attachments
```

- [ ] **Step 2: Copy files**

```bash
cp apps/server/pipeline/references.ts apps/server/notifications/references.ts
cp apps/server/pipeline/extract.ts apps/server/attachments/extract.ts
cp apps/server/pipeline/export.ts apps/server/documents/export.ts
```

- [ ] **Step 3: Update internal imports in moved files**

```bash
grep -n "from.*pipeline/" apps/server/notifications/references.ts apps/server/attachments/extract.ts apps/server/documents/export.ts
```

Adjust each found import to the correct relative path from the new location.

- [ ] **Step 4: Update importers**

```bash
grep -r "from.*pipeline/references\|from.*pipeline/extract\|from.*pipeline/export" apps/server --include="*.ts" -l
```

Update each. Common patterns:
- `../pipeline/references` → `../notifications/references`
- `../pipeline/extract` → `../attachments/extract`
- `../pipeline/export` → `../documents/export`

- [ ] **Step 5: Compile + test**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
pnpm --filter @sandwich/server test
```

- [ ] **Step 6: Delete originals + commit**

```bash
rm apps/server/pipeline/references.ts apps/server/pipeline/extract.ts apps/server/pipeline/export.ts
# check and move test files
ls apps/server/pipeline/references.test.ts apps/server/pipeline/export.test.ts 2>/dev/null
git add -A
git commit -m "refactor: move references, extract, export out of pipeline/"
```

---

## Task 4: Move `pipeline/orchestrate.ts` and `pipeline/prompts.ts` to `generation/`

These are core generation logic — they belong with the engine.

**Files:**
- Move: `pipeline/orchestrate.ts` → `generation/orchestrate.ts`
- Move: `pipeline/prompts.ts` → `generation/prompts.ts`
- Delete `pipeline/` folder (should now be empty or only contain `assets/` and `references/` subdirs — check first)

**Interfaces:**
- Produces: `generation/orchestrate.ts` exporting `stageInstruction`, `detectDeliverableType`, `detectPreviewIntent`, `detectRefineIntent`, `detectCancelIntent`, `hasLogoAndColorDetails`, `INITIAL_STAGE`, `type PipelineStage`
- Produces: `generation/prompts.ts` exporting `SANDWICH_PRD_GUIDE`, `SANDWICH_QUOTATION_GUIDE`, `SANDWICH_SPECS_GUIDE`, `GETOKUI_PROTOTYPE_GUIDE`

- [ ] **Step 1: Create generation folder**

```bash
mkdir -p apps/server/generation
```

- [ ] **Step 2: Copy files**

```bash
cp apps/server/pipeline/orchestrate.ts apps/server/generation/orchestrate.ts
cp apps/server/pipeline/prompts.ts apps/server/generation/prompts.ts
```

- [ ] **Step 3: Update importers**

```bash
grep -r "from.*pipeline/orchestrate\|from.*pipeline/prompts" apps/server --include="*.ts" -l
```

Update each:
- `../pipeline/orchestrate` → `../generation/orchestrate`
- `../pipeline/prompts` → `../generation/prompts`

- [ ] **Step 4: Check pipeline/ is now empty**

```bash
ls apps/server/pipeline/
```

Expected: only `assets/` subdirectory (static assets used by export). If `assets/` exists, move it:
```bash
mv apps/server/pipeline/assets apps/server/documents/assets
```
Update any import that references `pipeline/assets` path strings (likely in `export.ts` → now `documents/export.ts`).

- [ ] **Step 5: Delete pipeline/ folder**

```bash
rm -rf apps/server/pipeline/
```

- [ ] **Step 6: Compile + test**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
pnpm --filter @sandwich/server test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move orchestrate + prompts to generation/, delete pipeline/"
```

---

## Task 5: Move `engine/` files to `generation/`

**Files:**
- Move: `engine/tool-budget.ts` → `generation/budget.ts`
- Move: `engine/tool-budget.test.ts` → `generation/budget.test.ts`
- Move: `engine/bash-tool.ts` → `generation/bash-tool.ts`
- Delete `engine/` folder

**Interfaces:**
- Produces: `generation/budget.ts` exporting `createToolBudget`, `TOOL_BUDGETS`, `type ToolBudget`

- [ ] **Step 1: Copy files**

```bash
cp apps/server/engine/tool-budget.ts apps/server/generation/budget.ts
cp apps/server/engine/tool-budget.test.ts apps/server/generation/budget.test.ts
cp apps/server/engine/bash-tool.ts apps/server/generation/bash-tool.ts
```

- [ ] **Step 2: Update import inside budget.test.ts**

Open `generation/budget.test.ts`. The import will point to `./tool-budget` — change to `./budget`.

- [ ] **Step 3: Update importers across codebase**

```bash
grep -r "from.*engine/tool-budget\|from.*engine/bash-tool" apps/server --include="*.ts" -l
```

Update each:
- `../engine/tool-budget` → `../generation/budget`
- `../engine/bash-tool` → `../generation/bash-tool`
- `./tool-budget` (in test) → `./budget`

- [ ] **Step 4: Compile + test**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
pnpm --filter @sandwich/server test
```

- [ ] **Step 5: Delete engine/ + commit**

```bash
rm -rf apps/server/engine/
git add -A
git commit -m "refactor: move tool-budget + bash-tool to generation/, delete engine/"
```

---

## Task 6: Lift DB query files into feature folders

Move the three fat db files that belong to specific domains.

**Files:**
- Move: `db/conversations.ts` → `conversations/db.ts`
- Move: `db/documents.ts` → `documents/db.ts`
- Move: `db/projects.ts` → `projects/db.ts`
- Update all importers

**Interfaces:**
- `conversations/db.ts` exports everything `db/conversations.ts` currently exports (run `grep "^export" apps/server/db/conversations.ts` to get the list)
- `documents/db.ts` exports everything `db/documents.ts` currently exports
- `projects/db.ts` exports everything `db/projects.ts` currently exports

- [ ] **Step 1: Ensure feature folders exist**

```bash
mkdir -p apps/server/conversations apps/server/documents apps/server/projects
```

- [ ] **Step 2: Copy files**

```bash
cp apps/server/db/conversations.ts apps/server/conversations/db.ts
cp apps/server/db/documents.ts apps/server/documents/db.ts
cp apps/server/db/projects.ts apps/server/projects/db.ts
```

- [ ] **Step 3: Fix internal imports in moved files**

Each moved file imports from `../db/connection`, `../db/schema`, `../db/repo/*`. From the new location these become `../../db/connection`, etc. Check:

```bash
grep -n "from.*" apps/server/conversations/db.ts | head -20
grep -n "from.*" apps/server/documents/db.ts | head -20
grep -n "from.*" apps/server/projects/db.ts | head -20
```

Update each relative import: prepend one more `../` level since the files moved one folder deeper relative to `db/`.

- [ ] **Step 4: Update importers across the codebase**

```bash
grep -r "from.*db/conversations\|from.*db/documents\|from.*db/projects" apps/server --include="*.ts" -l
```

For each file, update:
- `../db/conversations` → `../conversations/db` (if importer is in a sibling folder) or `../../conversations/db` (if deeper)
- `../db/documents` → `../documents/db`
- `../db/projects` → `../projects/db`

The exact prefix depends on the importer's depth. Double-check by counting `../` hops.

- [ ] **Step 5: Compile**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

Expect zero errors. If there are import depth errors, fix them now — don't proceed with test failures.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @sandwich/server test
```

- [ ] **Step 7: Delete originals + commit**

```bash
rm apps/server/db/conversations.ts apps/server/db/documents.ts apps/server/db/projects.ts
git add -A
git commit -m "refactor: lift conversations/documents/projects db files into feature folders"
```

---

## Task 7: Redistribute `routes/` into feature folders (all except conversation-run)

Move every route file except `conversation-run.ts` into its feature folder.

**Files to move:**

| From | To |
|------|----|
| `routes/auth.ts` | `auth/routes.ts` |
| `routes/password-reset.ts` | `auth/password-reset.ts` |
| `routes/email-verification.ts` | `auth/email-verification.ts` |
| `routes/conversations.ts` | `conversations/routes.ts` |
| `routes/projects.ts` | `projects/routes.ts` |
| `routes/attachments.ts` | `attachments/routes.ts` |
| `routes/usage.ts` | `billing/usage.ts` |
| `routes/subscriptions.ts` | `billing/subscriptions.ts` |
| `routes/midtrans.ts` | `billing/midtrans-routes.ts` |
| `routes/share.ts` | `sharing/routes.ts` |
| `routes/settings.ts` | `account/settings.ts` |
| `routes/preferences.ts` | `account/preferences.ts` |
| `routes/documents.ts` | `documents/routes.ts` |
| `routes/admin.ts` | `admin/routes.ts` |

- [ ] **Step 1: Create missing folders**

```bash
mkdir -p apps/server/sharing apps/server/account apps/server/admin
```

(billing, attachments, conversations, projects, documents, notifications already exist from prior tasks)

- [ ] **Step 2: Copy all route files**

```bash
cp apps/server/routes/auth.ts apps/server/auth/routes.ts
cp apps/server/routes/password-reset.ts apps/server/auth/password-reset.ts
cp apps/server/routes/email-verification.ts apps/server/auth/email-verification.ts
cp apps/server/routes/conversations.ts apps/server/conversations/routes.ts
cp apps/server/routes/projects.ts apps/server/projects/routes.ts
cp apps/server/routes/attachments.ts apps/server/attachments/routes.ts
cp apps/server/routes/usage.ts apps/server/billing/usage.ts
cp apps/server/routes/subscriptions.ts apps/server/billing/subscriptions.ts
cp apps/server/routes/midtrans.ts apps/server/billing/midtrans-routes.ts
cp apps/server/routes/share.ts apps/server/sharing/routes.ts
cp apps/server/routes/settings.ts apps/server/account/settings.ts
cp apps/server/routes/preferences.ts apps/server/account/preferences.ts
cp apps/server/routes/documents.ts apps/server/documents/routes.ts
cp apps/server/routes/admin.ts apps/server/admin/routes.ts
```

- [ ] **Step 3: Fix imports inside each moved file**

For each moved file, imports like `../pipeline/X`, `../db/conversations`, `../auth/middleware` need to be re-based from the new location. The pattern:

- A file that was at `routes/auth.ts` importing `../auth/middleware` is now at `auth/routes.ts` — it becomes `./middleware`.
- A file importing `../db/conversations` is now importing from `../../conversations/db` if it's in a subfolder, or `../conversations/db` from a sibling folder.

Run this to see all imports per file before editing:
```bash
for f in apps/server/auth/routes.ts apps/server/auth/password-reset.ts apps/server/auth/email-verification.ts apps/server/conversations/routes.ts apps/server/projects/routes.ts apps/server/attachments/routes.ts apps/server/billing/usage.ts apps/server/billing/subscriptions.ts apps/server/billing/midtrans-routes.ts apps/server/sharing/routes.ts apps/server/account/settings.ts apps/server/account/preferences.ts apps/server/documents/routes.ts apps/server/admin/routes.ts; do echo "=== $f ==="; grep "^import" "$f"; done
```

Fix each relative import. Key remapping rules (old path → new path from the moved file's perspective):

From `auth/routes.ts` (was `routes/auth.ts`):
- `../auth/service` → `./service`
- `../auth/middleware` → `./middleware`
- `../auth/cookie` → `./cookie`
- `../auth/password` → `./password`
- `../auth/rate-limit` → `./rate-limit`
- `../pipeline/email` → `../notifications/email`
- `../db/users` → `../db/users` (unchanged — db/users is not moved)
- `../db/repo/email-verifications` → `../db/repo/email-verifications`
- `./email-verification` → `./email-verification` (sibling in auth/)

From `conversations/routes.ts` (was `routes/conversations.ts`):
- `../db/conversations` → `./db`
- `../auth/middleware` → `../auth/middleware`
- `../db/repo/attachments` → `../db/repo/attachments`

From `documents/routes.ts` (was `routes/documents.ts`):
- `../pipeline/export` → `./export`
- `../db/documents` → `./db`
- `../projects/workspace` → `../projects/workspace`

From `billing/midtrans-routes.ts` (was `routes/midtrans.ts`):
- `../pipeline/midtrans` → `./midtrans`
- `../pipeline/payment-status` → `./payment-status`
- `../pipeline/plans` → `./plans`

Apply equivalent logic for all other files.

- [ ] **Step 4: Update `web-server.ts` imports**

`web-server.ts` imports every `registerXxxRoutes` from `routes/`. Update all of them:

```typescript
// Before:
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPasswordResetRoutes } from "./routes/password-reset.js";
import { registerEmailVerificationRoutes } from "./routes/email-verification.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerUsageRoutes } from "./routes/usage.js";
import { registerShareRoutes } from "./routes/share.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerMidtransRoutes } from "./routes/midtrans.js";
import { registerSubscriptionRoutes } from "./routes/subscriptions.js";
import { registerPreferenceRoutes } from "./routes/preferences.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerAdminRoutes } from "./routes/admin.js";

// After:
import { registerAuthRoutes } from "./auth/routes.js";
import { registerPasswordResetRoutes } from "./auth/password-reset.js";
import { registerEmailVerificationRoutes } from "./auth/email-verification.js";
import { registerConversationRoutes } from "./conversations/routes.js";
import { registerProjectRoutes } from "./projects/routes.js";
import { registerAttachmentRoutes } from "./attachments/routes.js";
import { registerUsageRoutes } from "./billing/usage.js";
import { registerShareRoutes } from "./sharing/routes.js";
import { registerSettingsRoutes } from "./account/settings.js";
import { registerMidtransRoutes } from "./billing/midtrans-routes.js";
import { registerSubscriptionRoutes } from "./billing/subscriptions.js";
import { registerPreferenceRoutes } from "./account/preferences.js";
import { registerDocumentRoutes } from "./documents/routes.js";
import { registerAdminRoutes } from "./admin/routes.js";
```

Also update the `resetStaleExtractions` / `processExtraction` imports from `./pipeline/extract` → `./attachments/extract`.

- [ ] **Step 5: Compile**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

Fix any import depth errors that the compile surfaces. Don't guess — read the error path, count hops, fix.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @sandwich/server test
```

- [ ] **Step 7: Delete old route files**

```bash
rm apps/server/routes/auth.ts
rm apps/server/routes/password-reset.ts
rm apps/server/routes/email-verification.ts
rm apps/server/routes/conversations.ts
rm apps/server/routes/projects.ts
rm apps/server/routes/attachments.ts
rm apps/server/routes/usage.ts
rm apps/server/routes/subscriptions.ts
rm apps/server/routes/midtrans.ts
rm apps/server/routes/share.ts
rm apps/server/routes/settings.ts
rm apps/server/routes/preferences.ts
rm apps/server/routes/documents.ts
rm apps/server/routes/admin.ts
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: redistribute routes/ into feature folders"
```

---

## Task 8: Split `conversation-run.ts` — extract `generation/run.ts`

Extract the AI engine calls (`runTextGeneration`) and supporting utilities out of `conversation-run.ts` into `generation/run.ts`. This is the core of the god-file split.

**Files:**
- Create: `generation/run.ts`
- Modify: `routes/conversation-run.ts` (remove extracted code, import from `generation/run.ts`)

**What moves to `generation/run.ts`:**
- `buildMessages` (private helper)
- `ENGINE_TIMEOUT_MS` constant
- `READONLY_TOOLS`, `WRITE_TOOLS` constants
- `textEngineTools(stage)` exported function
- `runTextGeneration(opts)` async function
- `enrichMessageContent(m)` function
- `waitForExtraction(db, conversationId, timeout)` async function
- `deliverablePathFor(type)` exported function
- `commitMessageFor(...)` exported function
- `CHAT_INLINE_CAP` constant
- `chatOutputFor(type, content, previewUrl)` exported function
- `composePrototypeBrief(turns)` exported function
- `composeRefineInstruction(turns)` exported function

**What stays in `routes/conversation-run.ts` for now:**
- SSE / in-flight maps (`inFlight`, `sseClients`)
- `closeInFlight`
- `prototypePreviewUrl`
- `registerConversationRunRoutes` (route handlers)
- All types (`DocumentRef`, `ConversationRunEvent`, `ConversationTurn`, `Role`)

**Interfaces:**
- `generation/run.ts` exports:
  - `textEngineTools(stage: PipelineStage): readonly string[]`
  - `runTextGeneration(opts: { projectDir, conversationId, history, signal, stage, pendingType, refineInstruction? }): Promise<{ text: string; wroteFile: boolean }>`
  - `deliverablePathFor(type: DocumentType): string`
  - `commitMessageFor(type, mode, conversationId, stage, lastUserMessage): string`
  - `CHAT_INLINE_CAP: number`
  - `chatOutputFor(type, content, previewUrl): string`
  - `composePrototypeBrief(turns): string`
  - `composeRefineInstruction(turns): string`
  - `enrichMessageContent(m): string` (may be kept private if only used by runTextGeneration)
  - `waitForExtraction(db, conversationId, timeout): Promise<void>` (may be kept private)

- [ ] **Step 1: Create `generation/run.ts` with the extracted code**

Copy the relevant sections from `routes/conversation-run.ts`. The new file needs these imports (adjust paths from `generation/` perspective):

```typescript
import type { Database } from "../db/connection.js";
import { getMessagesForPrompt } from "../db/repo/chat-messages.js";
import { listAttachmentsByStatus } from "../db/repo/attachments.js";
import type { DocumentType } from "../documents/db.js";
import type { PipelineStage } from "./orchestrate.js";
import { resolveInsideProject, BRIEF_FILE, DELIVERABLE_FILES } from "../projects/workspace.js";
import { openConversationSession, sessionExists } from "../projects/sessions.js";
import { createToolBudget, TOOL_BUDGETS } from "./budget.js";
import { buildReferenceBlock } from "../notifications/references.js";
import {
  SANDWICH_PRD_GUIDE,
  SANDWICH_QUOTATION_GUIDE,
  SANDWICH_SPECS_GUIDE,
  GETOKUI_PROTOTYPE_GUIDE,
} from "./prompts.js";
import { stageInstruction } from "./orchestrate.js";
import { existsSync } from "node:fs";
import { resolveModel } from "../model-runtime.js";
```

Then paste the extracted functions, fixing any import references that differ from `routes/` perspective.

- [ ] **Step 2: Update `routes/conversation-run.ts` to import from `generation/run.ts`**

Remove the extracted code blocks and add at the top:

```typescript
import {
  textEngineTools,
  runTextGeneration,
  deliverablePathFor,
  commitMessageFor,
  CHAT_INLINE_CAP,
  chatOutputFor,
  composePrototypeBrief,
  composeRefineInstruction,
} from "../generation/run.js";
```

Remove all the now-duplicated function bodies.

- [ ] **Step 3: Compile**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

Fix any missing import or type errors before proceeding.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sandwich/server test
```

- [ ] **Step 5: Commit**

```bash
git add -A apps/server/generation/run.ts apps/server/routes/conversation-run.ts
git commit -m "refactor: extract generation engine logic into generation/run.ts"
```

---

## Task 9: Split `conversation-run.ts` — create `generation/routes.ts`

Now move the route handlers themselves. After this task, `routes/conversation-run.ts` is deleted.

**Files:**
- Create: `generation/routes.ts` — full route registrations
- Delete: `routes/conversation-run.ts`
- Modify: `web-server.ts` — update import

**What goes in `generation/routes.ts`:**
- `inFlight` and `sseClients` maps
- `closeInFlight` function
- `prototypePreviewUrl` function
- `DocumentRef` and `ConversationRunEvent` interfaces
- `registerConversationRunRoutes` function with all 5 route handlers:
  - `POST /api/conversations/:id/messages`
  - `PATCH /api/conversations/:id/messages/:messageId`
  - `POST /api/conversations/:id/generate`
  - `GET /api/conversations/:id/messages`
  - `GET /api/conversations/:id/stream`

**Interfaces:**
- Exports: `registerConversationRunRoutes(router, db): void`
- Exports: `closeInFlight(conversationId: string): void`
- Exports: `DocumentRef`, `ConversationRunEvent` (types consumed by frontend-facing API)

- [ ] **Step 1: Create `generation/routes.ts`**

Copy the remaining content from `routes/conversation-run.ts`. Update imports from `generation/` perspective:

```typescript
import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { markInFlight, clearInFlight, isInFlightRemote, publishEvent, subscribeToConversation } from "../redis.js";
import { getConversation, updateConversation, type Conversation } from "../conversations/db.js";
import { addChatMessage, createMessage, getMessages, getMessageHistory, getMessagesForPrompt, deleteMessage, updateMessageContent } from "../db/repo/chat-messages.js";
import { getPendingAttachmentIds } from "../db/repo/attachments.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { incrementUsage, getMonthlyUsage } from "../db/repo/usage.js";
import { PLANS } from "../billing/plans.js";
import { stageInstruction, detectDeliverableType, detectPreviewIntent, detectCancelIntent, hasLogoAndColorDetails, type PipelineStage } from "./orchestrate.js";
import { upsertDocument, findProjectDocument, listConversationDocuments, type DocumentType } from "../documents/db.js";
import { formatPrototypeSummary, generatePrototypeDocument } from "../prototype/engine.js";
import { parseRollbackIntent } from "../prototype/rollback.js";
import { getProjectDir, DELIVERABLE_FILES, BRIEF_FILE, resolveInsideProject, commitPaths, rollbackDeliverable } from "../projects/workspace.js";
import { buildBriefMarkdown, writeBrief, type BriefRole } from "../projects/brief.js";
import { acquireProjectLease, isLease, type ProjectLease } from "../projects/locks.js";
import { openConversationSession, sessionExists } from "../projects/sessions.js";
import { ensureProjectForConversation } from "../projects/db.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  textEngineTools,
  runTextGeneration,
  deliverablePathFor,
  commitMessageFor,
  CHAT_INLINE_CAP,
  chatOutputFor,
  composePrototypeBrief,
  composeRefineInstruction,
} from "./run.js";
```

- [ ] **Step 2: Update `web-server.ts`**

```typescript
// Before:
import { registerConversationRunRoutes } from "./routes/conversation-run.js";

// After:
import { registerConversationRunRoutes } from "./generation/routes.js";
```

- [ ] **Step 3: Compile**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sandwich/server test
```

- [ ] **Step 5: Delete old file and empty routes/ folder**

```bash
rm apps/server/routes/conversation-run.ts
rm apps/server/routes/conversation-run.test.ts 2>/dev/null || true
# If routes/ is now empty:
ls apps/server/routes/
rmdir apps/server/routes/ 2>/dev/null && echo "deleted" || echo "not empty — check"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: split conversation-run.ts into generation/run.ts + generation/routes.ts, delete routes/"
```

---

## Task 10: Final cleanup and verification

Confirm the restructure is complete, folder names match intent, and nothing is left behind.

- [ ] **Step 1: Verify old folders are gone**

```bash
ls apps/server/pipeline/ 2>/dev/null && echo "STILL EXISTS" || echo "deleted OK"
ls apps/server/engine/ 2>/dev/null && echo "STILL EXISTS" || echo "deleted OK"
ls apps/server/routes/ 2>/dev/null && echo "STILL EXISTS" || echo "deleted OK"
```

All three should print "deleted OK".

- [ ] **Step 2: Verify new folder structure**

```bash
find apps/server -maxdepth 1 -type d | sort
```

Expected output:
```
apps/server
apps/server/account
apps/server/admin
apps/server/attachments
apps/server/auth
apps/server/billing
apps/server/conversations
apps/server/db
apps/server/documents
apps/server/generation
apps/server/integrations
apps/server/notifications
apps/server/projects
apps/server/prototype
apps/server/sharing
apps/server/storage
```

- [ ] **Step 3: Full compile**

```bash
pnpm --filter @sandwich/server exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Full test suite**

```bash
pnpm --filter @sandwich/server test
```

Expected: all pass.

- [ ] **Step 5: Smoke-check no stale imports**

```bash
grep -r "from.*['\"]\.\.\/pipeline\/" apps/server --include="*.ts"
grep -r "from.*['\"]\.\.\/engine\/" apps/server --include="*.ts"
grep -r "from.*['\"]\.\.\/routes\/" apps/server --include="*.ts"
```

Each should return zero matches.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "refactor: backend restructure complete — feature folders, no pipeline/engine/routes/"
```
