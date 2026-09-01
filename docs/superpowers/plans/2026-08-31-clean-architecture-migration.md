# Clean Architecture Migration — Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise `apps/server/` from feature folders into three Clean Architecture layers (domain → application → infrastructure), with `eslint-plugin-boundaries` enforcing the dependency direction in CI.

**Architecture:** Three concentric layers; dependencies point inward only. `domain/` has zero project imports. `application/` imports only `domain/`. `infrastructure/` (DB, HTTP, AI, storage, email) imports `application/` and `domain/`. The composition root (`web-server.ts`) wires concrete implementations to use cases via constructor injection.

**Tech Stack:** TypeScript ESM (NodeNext), Drizzle ORM, custom `Router` class, Pi SDK (AI), `eslint-plugin-boundaries`

**Spec:** This plan is self-contained; no separate spec document.

## Global Constraints

- TypeScript ESM: all import paths end in `.js` (not `.ts`).
- Test command from repo root: `npm test` (compiles via tsc then runs node test runner).
- Typecheck only: `npm run typecheck`.
- Zero behaviour changes — no new features, no logic changes.
- No new npm runtime dependencies (only `eslint-plugin-boundaries` as a devDependency).
- No `apps/web/` changes.
- Each task must leave the test suite green before committing.
- The `db/schema.ts` file stays at `infrastructure/db/schema.ts` — it is the Drizzle schema, not a domain file.
- `db/connection.ts` stays at `infrastructure/db/connection.ts`.
- Migration strategy: add new layer files alongside old ones; swap callers; delete old files. Tests stay green throughout.

---

### Task 1: Add `eslint-plugin-boundaries` and CI enforcement

Install and configure the ESLint rule that enforces the three-layer dependency direction. Violations fail `npm run lint`, which runs in CI.

**Files:**
- Modify: `package.json` (root, add devDep + lint script if missing)
- Modify: `apps/server/package.json` (add devDep)
- Create: `apps/server/.eslintrc.cjs` (boundaries config)
- Modify: `.github/workflows/*.yml` (add lint step — find the existing CI file first)

**Interfaces:**
- Produces: `npm run lint` command that exits non-zero when a domain file imports from application or infrastructure

- [ ] **Step 1: Find the existing CI workflow file**

```bash
find .github/workflows -name "*.yml" | head -5
```

- [ ] **Step 2: Install `eslint-plugin-boundaries` as devDependency**

From repo root:
```bash
npm install --save-dev eslint-plugin-boundaries --workspace=apps/server
```

Verify it appears in `apps/server/package.json` under `devDependencies`.

- [ ] **Step 3: Create `apps/server/.eslintrc.cjs`**

```js
// apps/server/.eslintrc.cjs
const { defineConfig } = require("eslint");

module.exports = {
  root: true,
  plugins: ["boundaries"],
  settings: {
    "boundaries/elements": [
      { type: "domain",         pattern: "domain/*" },
      { type: "application",   pattern: "application/*" },
      { type: "infrastructure", pattern: "infrastructure/*" },
      // Shared utilities that have no layer affiliation
      { type: "shared",        pattern: ["*.ts", "db/connection.ts", "http-utils.ts", "router.ts", "redis.ts", "model-runtime.ts"] },
    ],
  },
  rules: {
    // domain must not import from application or infrastructure
    "boundaries/element-types": ["error", {
      default: "disallow",
      rules: [
        { from: "domain",         allow: ["domain", "shared"] },
        { from: "application",    allow: ["application", "domain", "shared"] },
        { from: "infrastructure", allow: ["infrastructure", "application", "domain", "shared"] },
        { from: "shared",         allow: ["shared"] },
      ],
    }],
  },
};
```

- [ ] **Step 4: Add a lint script to `apps/server/package.json`**

In the `scripts` block, add:
```json
"lint": "eslint 'domain/**/*.ts' 'application/**/*.ts' 'infrastructure/**/*.ts'"
```

- [ ] **Step 5: Add lint step to CI workflow**

In the existing CI yaml, after the typecheck or test step, add:
```yaml
- name: Lint (layer boundaries)
  run: npm run lint --workspace=apps/server
```

- [ ] **Step 6: Verify lint runs with zero errors (no layer files exist yet, so it's a no-op)**

```bash
cd apps/server && npx eslint 'domain/**/*.ts' 'application/**/*.ts' 'infrastructure/**/*.ts' 2>&1 || true
```

Expected: no output or "no files matched" — not a failure.

- [ ] **Step 7: Run tests to confirm nothing broke**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "build: add eslint-plugin-boundaries for CA layer enforcement"
```

---

### Task 2: Scaffold directory structure + domain layer skeleton

Create the three top-level directories and populate `domain/` with pure types and value objects extracted from existing files. No existing files are deleted yet — this only adds new files.

**Files:**
- Create: `apps/server/domain/conversations/index.ts`
- Create: `apps/server/domain/documents/index.ts`
- Create: `apps/server/domain/generation/index.ts`
- Create: `apps/server/domain/billing/index.ts`
- Create: `apps/server/domain/users/index.ts`
- Create: `apps/server/domain/projects/index.ts`
- Create: `apps/server/domain/attachments/index.ts`
- Create: `apps/server/application/.gitkeep`
- Create: `apps/server/infrastructure/.gitkeep`

**Interfaces:**
- Produces: domain types that application and infrastructure layers import from instead of from feature folders

**Source of truth for existing types:** read the following files before writing domain types:
- `apps/server/db/schema.ts` — Drizzle table shapes (derive entity types from these)
- `apps/server/documents/db.ts` — `DocumentType`, `Document`
- `apps/server/conversations/db.ts` — conversation + message types
- `apps/server/projects/db.ts` — project types
- `apps/server/db/users.ts` — `User`, `Session`
- `apps/server/billing/plans.ts` — `PlanConfig`, `PLANS`
- `apps/server/generation/orchestrate.ts` — `PipelineStage`

- [ ] **Step 1: Create directory skeleton**

```bash
mkdir -p apps/server/domain/conversations
mkdir -p apps/server/domain/documents
mkdir -p apps/server/domain/generation
mkdir -p apps/server/domain/billing
mkdir -p apps/server/domain/users
mkdir -p apps/server/domain/projects
mkdir -p apps/server/domain/attachments
mkdir -p apps/server/application
mkdir -p apps/server/infrastructure
touch apps/server/application/.gitkeep
touch apps/server/infrastructure/.gitkeep
```

- [ ] **Step 2: Create `domain/conversations/index.ts`**

Read `apps/server/conversations/db.ts` and `apps/server/db/schema.ts` for shape. Export only pure types — no imports from outside `domain/`:

```typescript
// domain/conversations/index.ts
export type Role = "system" | "user" | "assistant";

export interface ConversationTurn {
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  stage: string;
  pendingType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: Date;
}
```

- [ ] **Step 3: Create `domain/documents/index.ts`**

Read `apps/server/documents/db.ts` for the `Document` and `DocumentType` shapes:

```typescript
// domain/documents/index.ts
export type DocumentType = "prd" | "quotation" | "prototype" | "specs" | "mom";

export interface Document {
  id: string;
  userId: string;
  projectId: string;
  conversationId: string;
  title: string;
  type: DocumentType;
  relativePath: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Create `domain/generation/index.ts`**

Pure pipeline state machine — read `apps/server/generation/orchestrate.ts`. Copy the `PipelineStage` type and all pure functions verbatim:

```typescript
// domain/generation/index.ts
// Pure generation domain: stage type + transition logic. No imports.
import type { DocumentType } from "../documents/index.js";

export type PipelineStage =
  | "intake"
  | "choosing_deliverable"
  | "clarifying"
  | "generating"
  | "refining"
  | "awaiting_next";

export const INITIAL_STAGE: PipelineStage = "intake";

export function detectDeliverableType(message: string): DocumentType | null { /* copy verbatim */ }
export function detectPreviewIntent(message: string): boolean { /* copy verbatim */ }
export function detectRefineIntent(message: string): boolean { /* copy verbatim */ }
export function detectCancelIntent(message: string): boolean { /* copy verbatim */ }
export function hasLogoAndColorDetails(allUserText: string): boolean { /* copy verbatim */ }
export function stageInstruction(stage: PipelineStage, pendingType: DocumentType | null): string { /* copy verbatim */ }
```

Copy the full function bodies from `generation/orchestrate.ts` — do not leave placeholders.

- [ ] **Step 5: Create `domain/billing/index.ts`**

Read `apps/server/billing/plans.ts`. Copy `PlanConfig`, `PLANS`, `getPlan`, `generateOrderId` verbatim:

```typescript
// domain/billing/index.ts
import { randomBytes } from "node:crypto";

export interface PlanConfig { /* copy verbatim */ }
export const PLANS: Record<PlanConfig["slug"], PlanConfig> = { /* copy verbatim */ };
export function getPlan(slug: string): PlanConfig | undefined { /* copy verbatim */ }
export function generateOrderId(planSlug: string, userId: string): string { /* copy verbatim */ }
```

- [ ] **Step 6: Create `domain/users/index.ts`**

Read `apps/server/db/users.ts` for the `User` and `Session` shape (infer from schema, not Drizzle $inferSelect — domain types are plain interfaces):

```typescript
// domain/users/index.ts
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  role: "user" | "admin";
  createdAt: Date;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
```

- [ ] **Step 7: Create `domain/projects/index.ts`**

```typescript
// domain/projects/index.ts
export interface Project {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 8: Create `domain/attachments/index.ts`**

Read `apps/server/db/repo/attachments.ts` for the Attachment shape:

```typescript
// domain/attachments/index.ts
export type AttachmentStatus = "pending" | "processing" | "done" | "error";

export interface Attachment {
  id: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  status: AttachmentStatus;
  summary: string | null;
  createdAt: Date;
}
```

- [ ] **Step 9: Run typecheck to confirm new files compile**

```bash
npm run typecheck
```

- [ ] **Step 10: Run tests**

```bash
npm test
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: scaffold CA directory structure and domain layer types"
```

---

### Task 3: Define application ports (repository + service interfaces)

Create the interfaces that use cases depend on. These live in `application/ports/` and are the boundary between application and infrastructure. No implementations yet — only TypeScript interfaces.

**Files:**
- Create: `apps/server/application/ports/conversation-repository.ts`
- Create: `apps/server/application/ports/document-repository.ts`
- Create: `apps/server/application/ports/project-repository.ts`
- Create: `apps/server/application/ports/user-repository.ts`
- Create: `apps/server/application/ports/attachment-repository.ts`
- Create: `apps/server/application/ports/generation-port.ts`
- Create: `apps/server/application/ports/notification-port.ts`
- Create: `apps/server/application/ports/index.ts` (re-exports all ports)

**Interfaces:**
- Consumes: domain types from `../../domain/*/index.js`
- Produces: port interfaces that all application use cases import

Read the existing Drizzle query files to understand the full method set needed:
- `apps/server/conversations/db.ts`
- `apps/server/documents/db.ts`
- `apps/server/projects/db.ts`
- `apps/server/db/users.ts`
- `apps/server/db/repo/chat-messages.ts`
- `apps/server/db/repo/attachments.ts`
- `apps/server/db/repo/subscriptions.ts`
- `apps/server/db/payments.ts`
- `apps/server/generation/run.ts` (to understand what GenerationPort must provide)

- [ ] **Step 1: Create `application/ports/conversation-repository.ts`**

```typescript
import type { Conversation, ChatMessage, ConversationTurn } from "../../domain/conversations/index.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | undefined>;
  listForUser(userId: string): Promise<Conversation[]>;
  create(input: { userId: string; projectId: string; title: string }): Promise<Conversation>;
  updateStage(id: string, stage: PipelineStage, pendingType: DocumentType | null): Promise<void>;
  updateTitle(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
  getMessagesForPrompt(conversationId: string): Promise<ConversationTurn[]>;
  addMessage(conversationId: string, role: string, content: string): Promise<ChatMessage>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
}
```

- [ ] **Step 2: Create `application/ports/document-repository.ts`**

```typescript
import type { Document, DocumentType } from "../../domain/documents/index.js";

export interface DocumentRepository {
  findById(id: string): Promise<Document | undefined>;
  findOwnedById(userId: string, id: string): Promise<Document | undefined>;
  findByTitle(userId: string, title: string): Promise<Document | undefined>;
  listForUser(userId: string): Promise<Document[]>;
  upsert(input: {
    userId: string;
    projectId: string;
    conversationId: string;
    title: string;
    type: DocumentType;
    relativePath: string;
  }): Promise<Document>;
  updateTitle(id: string, title: string): Promise<void>;
}
```

- [ ] **Step 3: Create `application/ports/project-repository.ts`**

```typescript
import type { Project } from "../../domain/projects/index.js";

export interface ProjectRepository {
  findById(id: string): Promise<Project | undefined>;
  findOwnedById(userId: string, id: string): Promise<Project | undefined>;
  listForUser(userId: string): Promise<Project[]>;
  findOrCreateDefault(userId: string): Promise<Project>;
  create(input: { userId: string; title: string }): Promise<Project>;
  updateTitle(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 4: Create `application/ports/user-repository.ts`**

```typescript
import type { User, Session } from "../../domain/users/index.js";

export interface UserRepository {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  create(input: { id: string; username: string; email: string; passwordHash: string }): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateEmailVerified(id: string, verified: boolean): Promise<void>;
  ensureAdmin(input: { email: string; passwordHash: string }): Promise<{ created: boolean }>;
}

export interface SessionRepository {
  create(input: { userId: string; expiresAt: Date }): Promise<Session>;
  findByToken(token: string): Promise<Session | undefined>;
  delete(token: string): Promise<void>;
}
```

- [ ] **Step 5: Create `application/ports/attachment-repository.ts`**

```typescript
import type { Attachment, AttachmentStatus } from "../../domain/attachments/index.js";

export interface AttachmentRepository {
  findById(id: string): Promise<Attachment | undefined>;
  listByConversation(conversationId: string): Promise<Attachment[]>;
  listByStatus(status: AttachmentStatus): Promise<Attachment[]>;
  getPendingIds(conversationId: string): Promise<string[]>;
  updateStatus(id: string, status: AttachmentStatus, summary?: string): Promise<void>;
  resetStaleExtractions(): Promise<void>;
}
```

- [ ] **Step 6: Create `application/ports/generation-port.ts`**

Read `apps/server/generation/run.ts` — specifically `runTextGeneration` — to understand the full input/output contract:

```typescript
import type { ConversationTurn } from "../../domain/conversations/index.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";

export interface GenerationRequest {
  projectDir: string;
  conversationId: string;
  history: ConversationTurn[];
  signal: AbortSignal;
  stage: PipelineStage;
  pendingType: DocumentType | null;
  refineInstruction?: string | null;
}

export interface GenerationResult {
  text: string;
  wroteFile: boolean;
}

export interface GenerationPort {
  run(request: GenerationRequest): Promise<GenerationResult>;
}
```

- [ ] **Step 7: Create `application/ports/notification-port.ts`**

```typescript
export interface NotificationPort {
  sendPasswordReset(email: string, token: string): Promise<void>;
  sendEmailVerification(email: string, token: string): Promise<void>;
}
```

- [ ] **Step 8: Create `application/ports/index.ts`**

```typescript
export type { ConversationRepository } from "./conversation-repository.js";
export type { DocumentRepository } from "./document-repository.js";
export type { ProjectRepository } from "./project-repository.js";
export type { UserRepository, SessionRepository } from "./user-repository.js";
export type { AttachmentRepository } from "./attachment-repository.js";
export type { GenerationPort, GenerationRequest, GenerationResult } from "./generation-port.js";
export type { NotificationPort } from "./notification-port.js";
```

- [ ] **Step 9: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 10: Tests**

```bash
npm test
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: add application port interfaces (repository + service contracts)"
```

---

### Task 4: Application use cases — auth

Create the auth use cases in `application/auth/`. These replace the logic currently in `auth/service.ts` and the route handlers in `infrastructure/http/auth/`. The existing `auth/service.ts` is NOT deleted yet.

**Files:**
- Create: `apps/server/application/auth/register.ts`
- Create: `apps/server/application/auth/login.ts`
- Create: `apps/server/application/auth/logout.ts`
- Create: `apps/server/application/auth/forgot-password.ts`
- Create: `apps/server/application/auth/reset-password.ts`
- Create: `apps/server/application/auth/verify-email.ts`
- Create: `apps/server/application/auth/resend-verification.ts`
- Create: `apps/server/application/auth/index.ts`

**Interfaces:**
- Consumes: `UserRepository`, `SessionRepository` from `../ports/index.js`; `User`, `Session` from `../../domain/users/index.js`
- Produces: use-case functions with plain input/output types (no HTTP, no Drizzle)

Read before writing:
- `apps/server/auth/service.ts` — existing login/register logic to move
- `apps/server/auth/routes.ts` — to understand what inputs/outputs route handlers expect
- `apps/server/db/repo/password-resets.ts` and `apps/server/db/repo/email-verifications.ts`

The use cases must not import from `infrastructure/` or `db/`. They receive repositories via function parameters.

- [ ] **Step 1: Create `application/auth/register.ts`**

```typescript
import type { UserRepository, SessionRepository } from "../ports/index.js";
import type { User } from "../../domain/users/index.js";
import { hashPassword } from "../../infrastructure/auth/password.js"; // note: password hashing is infra

// ponytail: password hashing is technically infra — move to a crypto port if this layer ever needs to be pure
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  user: Pick<User, "id" | "username" | "email" | "role">;
  sessionToken: string;
}

export async function registerUser(
  repos: { users: UserRepository; sessions: SessionRepository },
  input: RegisterInput,
): Promise<RegisterResult> {
  // Copy logic verbatim from auth/service.ts register()
}
```

Follow the same pattern for all other auth use cases, copying logic from `auth/service.ts`.

- [ ] **Step 2: Create remaining use case files**

Apply the same pattern: `login.ts`, `logout.ts`, `forgot-password.ts`, `reset-password.ts`, `verify-email.ts`, `resend-verification.ts`. Each takes the relevant repositories as first parameter and returns a plain result type.

- [ ] **Step 3: Create `application/auth/index.ts`**

Re-export all use case functions.

- [ ] **Step 4: Write one assertion-based self-check in `application/auth/register.ts`**

```typescript
// Self-check: RegisterInput must have username, email, password
const _check: RegisterInput = { username: "u", email: "e@e.com", password: "p" };
void _check;
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: add application auth use cases"
```

---

### Task 5: Application use cases — conversations, projects, documents

Create use cases for the three main data-domain operations. Existing `conversations/routes.ts`, `projects/routes.ts`, `documents/routes.ts` are NOT deleted yet.

**Files:**
- Create: `apps/server/application/conversations/index.ts`
- Create: `apps/server/application/projects/index.ts`
- Create: `apps/server/application/documents/index.ts`

**Interfaces:**
- Consumes: `ConversationRepository`, `ProjectRepository`, `DocumentRepository` ports
- Produces: use-case functions with plain input/output; no HTTP, no Drizzle

Read before writing:
- `apps/server/conversations/routes.ts` — what operations exist
- `apps/server/projects/routes.ts`
- `apps/server/documents/routes.ts`
- `apps/server/conversations/db.ts`, `apps/server/projects/db.ts`, `apps/server/documents/db.ts`

- [ ] **Step 1: Create `application/conversations/index.ts`**

Expose: `listConversations(userId)`, `getConversation(userId, id)`, `createConversation(userId, projectId?, title)`, `deleteConversation(userId, id)`, `listConversationMessages(conversationId)`. Each takes `ConversationRepository` (and `ProjectRepository` where needed) as first param.

- [ ] **Step 2: Create `application/projects/index.ts`**

Expose: `listProjects(userId)`, `getProject(userId, id)`, `createProject(userId, title)`, `renameProject(userId, id, title)`, `deleteProject(userId, id)`.

- [ ] **Step 3: Create `application/documents/index.ts`**

Expose: `listDocuments(userId)`, `getDocument(userId, id)`, `findDocumentByTitle(userId, title)`, `updateDocumentTitle(userId, id, title)`. Export document from infrastructure is an infrastructure concern — the use case returns the Document entity; the HTTP layer calls the export infrastructure directly.

- [ ] **Step 4: Typecheck + tests**

```bash
npm run typecheck && npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: add application use cases for conversations, projects, documents"
```

---

### Task 6: Application use cases — billing

**Files:**
- Create: `apps/server/application/billing/index.ts`

**Interfaces:**
- Consumes: `UserRepository`, `PlanConfig` from domain, Drizzle subscription/payment repo via ports (add `SubscriptionRepository` to ports if not present)
- Produces: `getUserPlan(userId)`, `getUserUsage(userId)`, `checkDocumentQuota(userId, type)`

Read before writing:
- `apps/server/billing/usage.ts` (routes)
- `apps/server/billing/subscriptions.ts` (routes)
- `apps/server/db/repo/subscriptions.ts`
- `apps/server/db/repo/usage.ts`
- `apps/server/db/payments.ts`
- `apps/server/billing/plans.ts`

Add `SubscriptionRepository` and `PaymentRepository` interfaces to `application/ports/` if missing, following the same pattern as Task 3.

- [ ] **Step 1: Add missing port interfaces**

If `application/ports/subscription-repository.ts` doesn't exist, create it. Read `db/repo/subscriptions.ts` for the full method set needed.

- [ ] **Step 2: Create `application/billing/index.ts`**

```typescript
// use cases: getUserPlan, getUserUsage, checkDocumentQuota, expireStalePayments
// No imports from infrastructure. Takes repositories as parameters.
```

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: add application billing use cases"
```

---

### Task 7: Application use case — generation (runGeneration)

The most complex use case. Extracts the generation orchestration from `generation/routes.ts` (currently 718 lines) into a clean use case that calls `GenerationPort`, `ConversationRepository`, `DocumentRepository`, and `ProjectRepository` — no Pi SDK, no Drizzle, no HTTP.

**Files:**
- Create: `apps/server/application/generation/run-generation.ts`
- Create: `apps/server/application/generation/index.ts`

**Interfaces:**
- Consumes: `GenerationPort`, `ConversationRepository`, `DocumentRepository`, `ProjectRepository` ports; domain types from `domain/generation/`, `domain/conversations/`, `domain/documents/`
- Produces: `runGenerationUseCase(repos, port, input)` async function

Read before writing (IN FULL):
- `apps/server/generation/routes.ts` — the route handler contains the orchestration logic; extract only the non-HTTP parts
- `apps/server/generation/run.ts` — the engine execution (this becomes the `GenerationPort` implementation in infrastructure)

The use case owns: stage transitions, conversation history assembly, document commit, refine-intent detection, brief update, message storage. It does NOT own: SSE streaming, HTTP response writing, in-flight map management, Pi SDK calls.

- [ ] **Step 1: Read `generation/routes.ts` in full**

Map every top-level operation in the route handler to: (a) orchestration logic that belongs in the use case, or (b) HTTP/SSE infrastructure that stays in the route handler.

- [ ] **Step 2: Create `application/generation/run-generation.ts`**

```typescript
import type { ConversationRepository } from "../ports/conversation-repository.js";
import type { DocumentRepository } from "../ports/document-repository.js";
import type { ProjectRepository } from "../ports/project-repository.js";
import type { GenerationPort, GenerationResult } from "../ports/generation-port.js";
import type { PipelineStage } from "../../domain/generation/index.js";
import type { DocumentType } from "../../domain/documents/index.js";
import {
  detectDeliverableType,
  detectPreviewIntent,
  detectRefineIntent,
  detectCancelIntent,
  hasLogoAndColorDetails,
  INITIAL_STAGE,
} from "../../domain/generation/index.js";

export interface RunGenerationInput {
  userId: string;
  conversationId: string;
  userMessage: string;
  signal: AbortSignal;
  onEvent: (event: GenerationEvent) => void; // SSE pump — infra provides this
}

export type GenerationEvent =
  | { type: "stage"; stage: PipelineStage }
  | { type: "text"; text: string }
  | { type: "done"; wroteFile: boolean; documentId?: string }
  | { type: "error"; message: string };

export interface RunGenerationDeps {
  conversations: ConversationRepository;
  documents: DocumentRepository;
  projects: ProjectRepository;
  generation: GenerationPort;
}

export async function runGeneration(
  deps: RunGenerationDeps,
  input: RunGenerationInput,
): Promise<void> {
  // Port verbatim orchestration logic from generation/routes.ts
  // Replace direct Pi SDK calls with deps.generation.run(...)
  // Replace direct Drizzle calls with deps.conversations.*, deps.documents.*, deps.projects.*
  // Call input.onEvent() for each streaming event instead of writing to SSE directly
}
```

Copy the full orchestration logic — do NOT leave placeholders.

- [ ] **Step 3: Create `application/generation/index.ts`**

```typescript
export { runGeneration } from "./run-generation.js";
export type { RunGenerationInput, RunGenerationDeps, GenerationEvent } from "./run-generation.js";
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Fix all errors. This is the most complex task — read actual function signatures carefully.

- [ ] **Step 5: Tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: add application/generation runGeneration use case"
```

---

### Task 8: Infrastructure — DB implementations

Create Drizzle repository implementations of all port interfaces defined in Task 3. These live in `infrastructure/db/`. The existing `conversations/db.ts`, `documents/db.ts` etc. are NOT deleted yet — implementations delegate to the existing query functions until Task 11.

**Files:**
- Create: `apps/server/infrastructure/db/conversation-repository.ts`
- Create: `apps/server/infrastructure/db/document-repository.ts`
- Create: `apps/server/infrastructure/db/project-repository.ts`
- Create: `apps/server/infrastructure/db/user-repository.ts`
- Create: `apps/server/infrastructure/db/attachment-repository.ts`
- Create: `apps/server/infrastructure/db/subscription-repository.ts`
- Create: `apps/server/infrastructure/db/index.ts`

**Interfaces:**
- Consumes: port interfaces from `../../application/ports/index.js`; existing db query functions from `../../conversations/db.js` etc. (temporary delegation)
- Produces: concrete classes implementing each port interface, constructed with a `Database` instance

Pattern for each:
```typescript
import type { ConversationRepository } from "../../application/ports/conversation-repository.js";
import type { Database } from "../db/connection.js";  // wait — infrastructure/db IS the db folder; adjust paths
import { /* existing query fns */ } from "../../conversations/db.js"; // temporary delegation

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private db: Database) {}
  async findById(id: string) { return getConversationById(this.db, id); }
  // ... delegate all methods
}
```

Note: `infrastructure/db/` imports from existing feature-folder query files temporarily. Task 11 inlines those queries; Task 12 deletes the feature-folder files.

- [ ] **Step 1: Create each repository implementation file**

For each domain: read the port interface (Task 3), read the existing db query file, write a class that implements the interface by delegating to the query functions.

- [ ] **Step 2: Create `infrastructure/db/index.ts`**

```typescript
export { DrizzleConversationRepository } from "./conversation-repository.js";
export { DrizzleDocumentRepository } from "./document-repository.js";
export { DrizzleProjectRepository } from "./project-repository.js";
export { DrizzleUserRepository } from "./user-repository.js";
export { DrizzleAttachmentRepository } from "./attachment-repository.js";
export { DrizzleSubscriptionRepository } from "./subscription-repository.js";
```

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: add infrastructure/db Drizzle repository implementations"
```

---

### Task 9: Infrastructure — AI adapter (GenerationPort implementation)

Create the Pi SDK adapter that implements `GenerationPort`. This wraps the existing `generation/run.ts` `runTextGeneration` function.

**Files:**
- Create: `apps/server/infrastructure/ai/pi-generation-adapter.ts`
- Create: `apps/server/infrastructure/ai/index.ts`

**Interfaces:**
- Consumes: `GenerationPort`, `GenerationRequest`, `GenerationResult` from `../../application/ports/generation-port.js`; `runTextGeneration` from `../../generation/run.js` (temporary)
- Produces: `PiGenerationAdapter` class implementing `GenerationPort`

- [ ] **Step 1: Create `infrastructure/ai/pi-generation-adapter.ts`**

```typescript
import type { GenerationPort, GenerationRequest, GenerationResult } from "../../application/ports/generation-port.js";
import { runTextGeneration } from "../../generation/run.js"; // temporary delegation

export class PiGenerationAdapter implements GenerationPort {
  async run(request: GenerationRequest): Promise<GenerationResult> {
    return runTextGeneration(request);
  }
}
```

- [ ] **Step 2: Create `infrastructure/ai/index.ts`**

```typescript
export { PiGenerationAdapter } from "./pi-generation-adapter.js";
```

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: add infrastructure/ai PiGenerationAdapter"
```

---

### Task 10: Infrastructure — thin HTTP route handlers

Create thin route handlers in `infrastructure/http/` that call application use cases. The existing feature-folder route files remain until Task 12. These new handlers are NOT yet registered in `web-server.ts` — that happens in Task 11.

**Files:**
- Create: `apps/server/infrastructure/http/auth.ts`
- Create: `apps/server/infrastructure/http/conversations.ts`
- Create: `apps/server/infrastructure/http/projects.ts`
- Create: `apps/server/infrastructure/http/documents.ts`
- Create: `apps/server/infrastructure/http/generation.ts`
- Create: `apps/server/infrastructure/http/billing.ts`
- Create: `apps/server/infrastructure/http/sharing.ts`
- Create: `apps/server/infrastructure/http/account.ts`
- Create: `apps/server/infrastructure/http/admin.ts`
- Create: `apps/server/infrastructure/http/attachments.ts`
- Create: `apps/server/infrastructure/http/index.ts`

**Interfaces:**
- Consumes: all application use cases; `Router` from `../../router.js`; `sendJson`, `readJsonBody` from `../../http-utils.js`; `authenticateRequest` from `../../auth/middleware.js`
- Produces: `registerXxxRoutes(router, deps)` functions where `deps` carries pre-built use-case instances

The pattern for each route file:

```typescript
// infrastructure/http/conversations.ts
import type { Router } from "../../router.js";
import { sendJson, readJsonBody } from "../../http-utils.js";
import { authenticateRequest } from "../../auth/middleware.js";
import type { Database } from "../../db/connection.js";
import type { ConversationRepository } from "../../application/ports/index.js";
import { listConversations, getConversation, createConversation, deleteConversation } from "../../application/conversations/index.js";

export interface ConversationRouteDeps {
  db: Database; // for authenticateRequest until auth middleware moves
  conversations: ConversationRepository;
  projects: ProjectRepository;
}

export function registerConversationRoutes(router: Router, deps: ConversationRouteDeps): void {
  router.get("/api/conversations", async (req, res) => {
    const auth = await authenticateRequest(deps.db, req);
    if (!auth) { sendJson(res, 401, { error: "unauthenticated" }); return; }
    const convs = await listConversations(deps.conversations, auth.userId);
    sendJson(res, 200, convs);
  });
  // ... all other routes, each delegating to a use case function
}
```

Read the corresponding existing route file for every HTTP handler before writing.

- [ ] **Step 1: Write each route file**

For each file, read the existing feature-folder route file first (e.g. `conversations/routes.ts`), then write the thin infrastructure equivalent. Route paths, HTTP methods, request/response shapes must be identical — zero behaviour change.

The generation route handler (`infrastructure/http/generation.ts`) retains the SSE streaming and in-flight map — it wraps `runGeneration` use case and pumps events from `onEvent` callback into the SSE stream.

- [ ] **Step 2: Create `infrastructure/http/index.ts`**

Re-export all `registerXxxRoutes` functions.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

New files compile; old files still in place, tests still pass.

- [ ] **Step 4: Tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: add infrastructure/http thin route handlers"
```

---

### Task 11: Composition root — wire web-server.ts to new layers

Update `web-server.ts` to construct all infrastructure implementations and inject them into the new route handlers. Switch from old `registerXxxRoutes` to new `infrastructure/http/` versions. This is the cutover commit — after this, the app runs on the new architecture.

**Files:**
- Modify: `apps/server/web-server.ts`

**Interfaces:**
- Consumes: all `infrastructure/db/*` repo classes; `PiGenerationAdapter` from `infrastructure/ai/`; all `registerXxxRoutes` from `infrastructure/http/`
- Produces: working server using CA layers end-to-end

- [ ] **Step 1: Read current `web-server.ts` in full**

Understand every import and every `registerXxxRoutes` call.

- [ ] **Step 2: Update imports**

Replace old route imports:
```typescript
// Before:
import { registerConversationRoutes } from "./conversations/routes.js";
// After:
import { registerConversationRoutes } from "./infrastructure/http/index.js";
```

Do this for every route registration.

- [ ] **Step 3: Add infrastructure construction**

After `const db = await openDb(...)`:
```typescript
// Infrastructure implementations
const conversationRepo = new DrizzleConversationRepository(db);
const documentRepo = new DrizzleDocumentRepository(db);
const projectRepo = new DrizzleProjectRepository(db);
const userRepo = new DrizzleUserRepository(db);
const attachmentRepo = new DrizzleAttachmentRepository(db);
const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const generationAdapter = new PiGenerationAdapter();

const deps = { db, conversations: conversationRepo, documents: documentRepo, projects: projectRepo, users: userRepo, attachments: attachmentRepo, subscriptions: subscriptionRepo, generation: generationAdapter };
```

- [ ] **Step 4: Update every registerXxxRoutes call to pass deps**

```typescript
registerConversationRoutes(router, deps);
registerGenerationRoutes(router, deps);
// etc.
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Fix all errors. This step likely surfaces mismatches between dep types expected by route handlers and what deps provides — fix them.

- [ ] **Step 6: Tests**

```bash
npm test
```

All 293+ tests must pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: wire composition root to CA layers in web-server.ts"
```

---

### Task 12: Delete old feature-folder files and verify

With all callers now using the new CA layers, delete the old feature-folder source files (everything that is now either in `domain/`, `application/`, or `infrastructure/`). Then verify no stale imports remain, run final typecheck and tests, delete the SDD workspace.

**Files:**
- Delete: `apps/server/conversations/routes.ts` (replaced by `infrastructure/http/conversations.ts`)
- Delete: `apps/server/projects/routes.ts`
- Delete: `apps/server/documents/routes.ts`
- Delete: `apps/server/billing/midtrans-routes.ts`, `billing/usage.ts`, `billing/subscriptions.ts`
- Delete: `apps/server/auth/routes.ts`, `auth/email-verification.ts`, `auth/password-reset.ts`
- Delete: `apps/server/sharing/routes.ts`, `account/settings.ts`, `account/preferences.ts`, `admin/routes.ts`
- Delete: `apps/server/generation/routes.ts`
- Delete: `apps/server/billing/plans.ts` (moved to domain), `billing/payment-status.ts` (moved to infra)
- Delete: `apps/server/generation/orchestrate.ts` (moved to domain)
- Delete folders: `apps/server/sharing/`, `apps/server/account/` (now empty)
- **Do NOT delete:** `auth/service.ts`, `auth/middleware.ts`, `auth/password.ts`, `auth/cookie.ts`, `auth/token.ts`, `auth/rate-limit.ts` — these are infra files still used directly

- [ ] **Step 1: Identify all files safe to delete**

For each old file, confirm no remaining importer references it:
```bash
grep -r "from.*conversations/routes" apps/server --include="*.ts"
# repeat for each file
```

Only delete files with zero remaining importers.

- [ ] **Step 2: Delete confirmed files**

```bash
git rm apps/server/conversations/routes.ts
# ... etc for each confirmed file
```

- [ ] **Step 3: Stale import scan**

```bash
# These should all return zero results:
grep -r "from.*['\"]\.\.\/conversations/routes" apps/server --include="*.ts"
grep -r "from.*['\"]\.\.\/generation/routes" apps/server --include="*.ts"
# Add one grep per deleted file
```

- [ ] **Step 4: Final typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 5: Full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Run linter to verify boundaries are respected**

```bash
cd apps/server && npx eslint 'domain/**/*.ts' 'application/**/*.ts' 'infrastructure/**/*.ts'
```

Expected: zero violations.

- [ ] **Step 7: Verify folder structure**

```bash
find apps/server -maxdepth 1 -type d | sort
```

Expected top-level dirs: `account` (if non-empty), `admin`, `attachments`, `auth`, `billing`, `conversations`, `db`, `documents`, `domain`, `application`, `infrastructure`, `generation`, `integrations`, `notifications`, `projects`, `prototype`, `sharing` (if non-empty), `storage`.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "refactor: clean architecture migration complete — delete old feature-folder route files"
```
