# Pipeline Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Judge → Implement → Verify pipeline stages for a single ticket, stopping at a `ready_for_pr` outcome (Open PR is out of scope — see the design doc).

**Architecture:** A new `src/pipeline/` directory with one file per stage (`judge.ts`, `implement.ts`, `verify.ts`) plus a thin orchestrator (`run.ts`) that sequences them against a single git worktree, persisting state to the existing `runs` table after every stage transition. Judge is stubbed to always return agent-ready. Full rationale: `docs/superpowers/specs/2026-08-03-pipeline-shape-design.md`.

**Tech Stack:** TypeScript (strict), `better-sqlite3`, Node's built-in `node:child_process`/`node:assert` — no test framework, no new runtime dependencies.

## Global Constraints

- Follow this repo's existing test convention exactly: hand-rolled `node:assert` tests, no framework, one `*.test.ts` file per module with its own `main()` (or top-level `await`/`void main()` for async files, matching `src/engine/*.test.ts`), run individually via `node dist/<path>.test.js` after building — **not** wired into `npm run selftest`. This matches how `src/engine/*.test.ts` and `src/db/*.test.ts` already work.
- TypeScript strict mode is on (`strict: true`, `noUncheckedIndexedAccess: true`) — every new file must satisfy `tsc -p tsconfig.json` with zero errors.
- Module resolution is `NodeNext` — every relative import must use an explicit `.js` extension even though the source file is `.ts` (e.g. `import { foo } from "./bar.js"`).
- Do **not** modify `src/config.ts`, `src/types.ts`, or `src/db/migrations/0001_init.ts` — the first two belong to the prior attempt's pipeline and aren't the foundation this restart extends; the third is an already-applied migration and migrations are never edited after the fact (new tables go in a new migration file).
- Run `npm run build` (full build, including the `web/` frontend) and `npm run selftest` at the end of every task, before committing — confirm nothing already-working broke. Use the faster `npx tsc -p tsconfig.json` for iterating on individual steps within a task.
- Every task's completion commit appends one line to `CHANGELOG.md`, format: `- 2026-08-03: [pipeline-shape] | @potensio - <what it delivered>`.
- Never run `src/engine/manual-check.ts` or `src/engine/manual-check-pty.ts` (or anything that shells out to them) — they invoke the real Claude Code CLI and cost real tokens. Nothing in this plan needs them.

---

### Task 1: Shared pipeline types

**Files:**
- Create: `src/pipeline/types.ts`
- Test: `src/pipeline/types.test.ts`

**Interfaces:**
- Consumes: `EngineInvoker` (`src/engine/types.ts`), `Ticket` (`src/db/tickets.ts`), `Database.Database` (`better-sqlite3`)
- Produces: `PipelineContext`, `NeedsHumanCategory`, `JudgeResult`, `ImplementOutcome`, `ImplementResult`, `VerifyOutcome`, `VerifyResult` — used by every later task in this plan

- [ ] **Step 1: Write `src/pipeline/types.ts`**

```typescript
import type Database from "better-sqlite3";
import type { EngineInvoker } from "../engine/types.js";
import type { Ticket } from "../db/tickets.js";

/**
 * Everything a pipeline stage needs to do its job. Built once per run by
 * the orchestrator (run.ts) and passed unchanged to judge(), implement(),
 * and verify() — they all operate on the same worktree/db/run.
 */
export interface PipelineContext {
  db: Database.Database;
  runId: string;
  ticket: Ticket;
  engine: EngineInvoker;
  /** e.g. "claude-code-pty" — stored verbatim in runs.engine. */
  engineName: string;
  worktreePath: string;
  baseCommit: string;
  implementTimeoutMs: number;
  verifyTimeoutMs: number;
}

/**
 * The Phase 1 spec's fixed needs-human vocabulary. Only populated for stops
 * that map onto one of these with a straight face — see the design doc's
 * "Outcome model" section for which stops get null instead.
 */
export type NeedsHumanCategory =
  | "ambiguous_ticket"
  | "forbidden_path_or_action"
  | "weak_verification"
  | "missing_context";

/**
 * Judge is stubbed in this plan (see judge.ts) — it always returns
 * agent_ready, so this type only models that one outcome for now. Real
 * Judge logic (once the readiness-scan piece exists) will need to widen
 * this to include a needs-human path with a category.
 */
export interface JudgeResult {
  outcome: "agent_ready";
}

export type ImplementOutcome =
  | "changes_committed"
  | "no_changes"
  | "needs_human"
  | "implement_timeout"
  | "implement_error"
  | "implement_nonzero_exit";

export interface ImplementResult {
  outcome: ImplementOutcome;
  needsHumanCategory: NeedsHumanCategory | null;
  needsHumanReason: string | null;
}

export type VerifyOutcome = "ready_for_pr" | "needs_human" | "verify_failed" | "verify_timeout";

export interface VerifyResult {
  outcome: VerifyOutcome;
  needsHumanCategory: NeedsHumanCategory | null;
  needsHumanReason: string | null;
}
```

- [ ] **Step 2: Write `src/pipeline/types.test.ts`**

```typescript
import type Database from "better-sqlite3";
import type { EngineInvoker } from "../engine/types.js";
import type { Ticket } from "../db/tickets.js";
import type {
  PipelineContext,
  JudgeResult,
  ImplementResult,
  VerifyResult,
  NeedsHumanCategory,
} from "./types.js";

// This file has no runtime assertions — it's a compile-time check that
// every pipeline type is actually constructible/consumable as designed.
// If this file fails to typecheck, that's the test failing.

const fakeTicket: Ticket = {
  key: "PROJ-1",
  summary: "s",
  description: "d",
  url: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const fakeEngine: EngineInvoker = {
  async run() {
    return { outcome: "ok", finalText: "", transcript: [], durationSec: 0, exitCode: 0 };
  },
};

function checkContextShape(db: Database.Database): PipelineContext {
  return {
    db,
    runId: "run-1",
    ticket: fakeTicket,
    engine: fakeEngine,
    engineName: "claude-code-pty",
    worktreePath: "/tmp/example",
    baseCommit: "abc123",
    implementTimeoutMs: 1000,
    verifyTimeoutMs: 1000,
  };
}

const judgeResult: JudgeResult = { outcome: "agent_ready" };

const changesCommitted: ImplementResult = {
  outcome: "changes_committed",
  needsHumanCategory: null,
  needsHumanReason: null,
};

const forbiddenPath: ImplementResult = {
  outcome: "needs_human",
  needsHumanCategory: "forbidden_path_or_action",
  needsHumanReason: "matched a blocklist entry",
};

const readyForPr: VerifyResult = {
  outcome: "ready_for_pr",
  needsHumanCategory: null,
  needsHumanReason: null,
};

const weakVerification: VerifyResult = {
  outcome: "needs_human",
  needsHumanCategory: "weak_verification",
  needsHumanReason: "no test command known",
};

const allCategories: NeedsHumanCategory[] = [
  "ambiguous_ticket",
  "forbidden_path_or_action",
  "weak_verification",
  "missing_context",
];

console.log(
  "PASS: pipeline types are constructible",
  checkContextShape.name,
  judgeResult,
  changesCommitted,
  forbiddenPath,
  readyForPr,
  weakVerification,
  allCategories.length,
);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.json`
Expected: no errors. (This is a shape-check file, not a runtime test — compiling cleanly is the only pass condition.)

- [ ] **Step 4: Run it**

Run: `node dist/pipeline/types.test.js`
Expected: prints `PASS: pipeline types are constructible ...`

- [ ] **Step 5: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed (`selftest` still ends with `38 lolos, 0 gagal.` — untouched by this task).

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added shared pipeline stage types (PipelineContext, Judge/Implement/Verify result types) for the new Judge -> Implement -> Verify sequence (src/pipeline/types.ts)
```

```bash
git add src/pipeline/types.ts src/pipeline/types.test.ts CHANGELOG.md
git commit -m "Add shared pipeline stage types"
```

---

### Task 2: `run_artifacts` storage

**Files:**
- Create: `src/db/migrations/0002_run_artifacts.ts`
- Modify: `src/db/migrations/index.ts`
- Create: `src/db/run-artifacts.ts`
- Test: `src/db/run-artifacts.test.ts`

**Interfaces:**
- Consumes: `Migration` (`src/db/migrations/types.ts`), `openDb` (`src/db/connection.ts`), `upsertTicket`/`insertRun` (existing, for test fixtures)
- Produces: `RunArtifactKind`, `RunArtifact`, `NewRunArtifact`, `insertRunArtifact(db, input): RunArtifact`, `listArtifactsForRun(db, runId): RunArtifact[]` — used by Implement (Task 5) and Verify (Task 6)

- [ ] **Step 1: Write the failing test — `src/db/run-artifacts.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun } from "./runs.js";
import { insertRunArtifact, listArtifactsForRun } from "./run-artifacts.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "run-artifacts-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function makeRun(db: Database.Database) {
  upsertTicket(db, { key: "PROJ-1", summary: "s", description: "d" });
  return insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });
}

function testInsertsAndListsArtifactsForARun(): void {
  const db = openTestDb();
  const run = makeRun(db);

  insertRunArtifact(db, {
    runId: run.id,
    kind: "implement_transcript",
    content: "line one\nline two",
  });
  insertRunArtifact(db, { runId: run.id, kind: "diff_patch", content: "diff --git a/x b/x" });

  const artifacts = listArtifactsForRun(db, run.id);
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0]!.kind, "implement_transcript");
  assert.equal(artifacts[1]!.kind, "diff_patch");
  console.log("PASS: testInsertsAndListsArtifactsForARun");
}

function testListReturnsEmptyForRunWithNoArtifacts(): void {
  const db = openTestDb();
  const run = makeRun(db);
  assert.deepEqual(listArtifactsForRun(db, run.id), []);
  console.log("PASS: testListReturnsEmptyForRunWithNoArtifacts");
}

function testInsertFailsForUnknownRun(): void {
  const db = openTestDb();
  assert.throws(() => {
    insertRunArtifact(db, { runId: "does-not-exist", kind: "verify_output", content: "x" });
  });
  console.log("PASS: testInsertFailsForUnknownRun");
}

function main(): void {
  testInsertsAndListsArtifactsForARun();
  testListReturnsEmptyForRunWithNoArtifacts();
  testInsertFailsForUnknownRun();
}

main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './run-artifacts.js'` (neither the migration nor the repository module exist yet)

- [ ] **Step 3: Write the migration — `src/db/migrations/0002_run_artifacts.ts`**

```typescript
import type { Migration } from "./types.js";

export const migration0002RunArtifacts: Migration = {
  version: 2,
  name: "run_artifacts",
  sql: `
CREATE TABLE run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_run_artifacts_run_id ON run_artifacts(run_id);
`,
};
```

- [ ] **Step 4: Register the migration — modify `src/db/migrations/index.ts`**

```typescript
import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002RunArtifacts } from "./0002_run_artifacts.js";

export const MIGRATIONS: Migration[] = [migration0001Init, migration0002RunArtifacts];
```

- [ ] **Step 5: Write the repository module — `src/db/run-artifacts.ts`**

```typescript
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type RunArtifactKind =
  | "judge_prompt"
  | "judge_transcript"
  | "implement_transcript"
  | "diff_patch"
  | "verify_output";

export interface RunArtifact {
  id: string;
  runId: string;
  kind: RunArtifactKind;
  content: string;
  createdAt: string;
}

export interface NewRunArtifact {
  runId: string;
  kind: RunArtifactKind;
  content: string;
}

/**
 * Large, opaque per-run text blobs (transcripts, diffs, raw test output).
 * Split from `runs` because they're write-once and never queried, only
 * displayed — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md
 * "Artifacts".
 */
export function insertRunArtifact(db: Database.Database, input: NewRunArtifact): RunArtifact {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO run_artifacts (id, run_id, kind, content, created_at)
     VALUES (@id, @runId, @kind, @content, @createdAt)`,
  ).run({ id, runId: input.runId, kind: input.kind, content: input.content, createdAt });
  return { id, runId: input.runId, kind: input.kind, content: input.content, createdAt };
}

export function listArtifactsForRun(db: Database.Database, runId: string): RunArtifact[] {
  const rows = db
    .prepare("SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY created_at")
    .all(runId) as RawRow[];
  return rows.map(mapRow);
}

interface RawRow {
  id: string;
  run_id: string;
  kind: string;
  content: string;
  created_at: string;
}

function mapRow(row: RawRow): RunArtifact {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind as RunArtifactKind,
    content: row.content,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/db/run-artifacts.test.js`
Expected: `PASS: testInsertsAndListsArtifactsForARun`, `PASS: testListReturnsEmptyForRunWithNoArtifacts`, `PASS: testInsertFailsForUnknownRun`

- [ ] **Step 7: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 8: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the run_artifacts table and repository module for storing per-run transcripts/diffs/test output (src/db/migrations/0002_run_artifacts.ts, src/db/run-artifacts.ts)
```

```bash
git add src/db/migrations/0002_run_artifacts.ts src/db/migrations/index.ts src/db/run-artifacts.ts src/db/run-artifacts.test.ts CHANGELOG.md
git commit -m "Add run_artifacts storage"
```

---

### Task 3: Pipeline instance config

**Files:**
- Create: `src/pipeline/config.ts`
- Create: `config/instance.example.json`
- Test: `src/pipeline/config.test.ts`

**Interfaces:**
- Consumes: nothing new (plain `node:fs`/`node:path`)
- Produces: `PipelineConfig`, `loadPipelineConfig(configPath): PipelineConfig` — used by the orchestrator (Task 7)

- [ ] **Step 1: Write the failing test — `src/pipeline/config.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadPipelineConfig } from "./config.js";

function writeConfig(contents: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "pipeline-config-test-"));
  const path = join(dir, "instance.json");
  writeFileSync(path, JSON.stringify(contents), "utf8");
  return path;
}

function testResolvesRelativePathsAgainstProjectRootNotConfigDir(): void {
  // The config file lives in a `config/` subdirectory of the project root
  // (matching config/instance.example.json's real location) — relative
  // paths must resolve against the project root (found via package.json),
  // not against `config/` itself, or "../runchise"-style paths land one
  // directory level off from what's intended.
  const projectRoot = mkdtempSync(join(tmpdir(), "pipeline-config-project-"));
  writeFileSync(join(projectRoot, "package.json"), "{}", "utf8");
  mkdirSync(join(projectRoot, "config"), { recursive: true });
  const configPath = join(projectRoot, "config", "instance.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      repoPath: "sibling-repo",
      worktreeRoot: ".work/worktrees",
      branchPrefix: "agent/",
      baseBranch: "main",
    }),
    "utf8",
  );

  const config = loadPipelineConfig(configPath);
  assert.equal(config.repoPath, resolve(projectRoot, "sibling-repo"));
  assert.equal(config.worktreeRoot, resolve(projectRoot, ".work/worktrees"));
  console.log("PASS: testResolvesRelativePathsAgainstProjectRootNotConfigDir");
}

function testLoadsMinimalConfigWithDefaults(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
  });

  const config = loadPipelineConfig(path);
  assert.equal(config.engineMode, "pty");
  assert.equal(config.implementTimeoutMs, 1200000);
  assert.equal(config.verifyTimeoutMs, 1800000);
  assert.ok(config.repoPath.endsWith("/repo"));
  assert.ok(!config.repoPath.startsWith(".."), "repoPath should be resolved to an absolute path");
  console.log("PASS: testLoadsMinimalConfigWithDefaults");
}

function testRespectsExplicitOverrides(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "headless",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 6000,
  });

  const config = loadPipelineConfig(path);
  assert.equal(config.engineMode, "headless");
  assert.equal(config.implementTimeoutMs, 5000);
  assert.equal(config.verifyTimeoutMs, 6000);
  console.log("PASS: testRespectsExplicitOverrides");
}

function testThrowsWhenRequiredFieldMissing(): void {
  const path = writeConfig({ repoPath: "../repo" });
  assert.throws(() => loadPipelineConfig(path), /worktreeRoot/);
  console.log("PASS: testThrowsWhenRequiredFieldMissing");
}

function testThrowsWhenEngineModeInvalid(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "carrier-pigeon",
  });
  assert.throws(() => loadPipelineConfig(path), /engineMode/);
  console.log("PASS: testThrowsWhenEngineModeInvalid");
}

function main(): void {
  testResolvesRelativePathsAgainstProjectRootNotConfigDir();
  testLoadsMinimalConfigWithDefaults();
  testRespectsExplicitOverrides();
  testThrowsWhenRequiredFieldMissing();
  testThrowsWhenEngineModeInvalid();
}

main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 3: Write `src/pipeline/config.ts`**

```typescript
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface PipelineConfig {
  repoPath: string;
  worktreeRoot: string;
  branchPrefix: string;
  baseBranch: string;
  engineMode: "headless" | "pty";
  implementTimeoutMs: number;
  verifyTimeoutMs: number;
}

const REQUIRED_STRING_FIELDS = ["repoPath", "worktreeRoot", "branchPrefix", "baseBranch"] as const;

const DEFAULT_ENGINE_MODE = "pty";
const DEFAULT_IMPLEMENT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_VERIFY_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Nearest ancestor directory containing a package.json, used as the base
 * for resolving this config's relative paths — so "../runchise" means
 * sibling-of-project-root regardless of which subdirectory the config file
 * itself lives in (e.g. config/instance.json). Falls back to startDir if
 * none is found within 10 levels. Mirrors the equivalent helper already in
 * the legacy src/config.ts (reimplemented here rather than imported — that
 * module belongs to the prior attempt's pipeline, not this one).
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * A minimal instance config distinct from the legacy `config/pipeline.json`
 * (see docs/superpowers/plans/2026-08-03-storage-sqlite.md, which already
 * established that src/config.ts's Config type belongs to the prior
 * attempt's pipeline and isn't extended here). Engine mode defaults to
 * "pty" — a deliberate instance-level override of the Phase 1 spec's
 * originally recommended "headless" default; see
 * docs/superpowers/specs/2026-08-03-pipeline-shape-design.md.
 */
export function loadPipelineConfig(configPath: string): PipelineConfig {
  const absConfigPath = resolve(configPath);

  if (!existsSync(absConfigPath)) {
    throw new Error(`Pipeline config not found: ${absConfigPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absConfigPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Pipeline config is not valid JSON (${absConfigPath}): ${(err as Error).message}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Pipeline config must be a JSON object: ${absConfigPath}`);
  }

  const raw = parsed as Record<string, unknown>;

  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof raw[key] !== "string") {
      throw new Error(`Pipeline config missing required string field "${key}": ${absConfigPath}`);
    }
  }

  const rawEngineMode = raw["engineMode"];
  if (rawEngineMode !== undefined && rawEngineMode !== "headless" && rawEngineMode !== "pty") {
    throw new Error(
      `Pipeline config "engineMode" must be "headless" or "pty", got ${JSON.stringify(rawEngineMode)}: ${absConfigPath}`,
    );
  }

  const projectRoot = findProjectRoot(dirname(absConfigPath));
  const abs = (p: string): string => (isAbsolute(p) ? p : resolve(projectRoot, p));

  const rawImplementTimeoutMs = raw["implementTimeoutMs"];
  const rawVerifyTimeoutMs = raw["verifyTimeoutMs"];

  return {
    repoPath: abs(raw["repoPath"] as string),
    worktreeRoot: abs(raw["worktreeRoot"] as string),
    branchPrefix: raw["branchPrefix"] as string,
    baseBranch: raw["baseBranch"] as string,
    engineMode: rawEngineMode ?? DEFAULT_ENGINE_MODE,
    implementTimeoutMs:
      typeof rawImplementTimeoutMs === "number" ? rawImplementTimeoutMs : DEFAULT_IMPLEMENT_TIMEOUT_MS,
    verifyTimeoutMs:
      typeof rawVerifyTimeoutMs === "number" ? rawVerifyTimeoutMs : DEFAULT_VERIFY_TIMEOUT_MS,
  };
}
```

- [ ] **Step 4: Write `config/instance.example.json`**

```json
{
  "repoPath": "../runchise",
  "worktreeRoot": ".work/worktrees",
  "branchPrefix": "agent/",
  "baseBranch": "master",
  "engineMode": "pty",
  "implementTimeoutMs": 1200000,
  "verifyTimeoutMs": 1800000
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/pipeline/config.test.js`
Expected: all four `PASS:` lines print.

- [ ] **Step 6: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 7: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the Pipeline shape instance config loader, defaulting engine mode to PTY (src/pipeline/config.ts, config/instance.example.json)
```

```bash
git add src/pipeline/config.ts src/pipeline/config.test.ts config/instance.example.json CHANGELOG.md
git commit -m "Add pipeline instance config loader"
```

---

### Task 4: Judge stage (stub)

**Files:**
- Create: `src/pipeline/judge.ts`
- Test: `src/pipeline/judge.test.ts`

**Interfaces:**
- Consumes: `PipelineContext`, `JudgeResult` (Task 1)
- Produces: `judge(ctx: PipelineContext): Promise<JudgeResult>` — used by the orchestrator (Task 7)

- [ ] **Step 1: Write the failing test — `src/pipeline/judge.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { judge } from "./judge.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "judge-test-"));
  return openDb(join(dir, "db.sqlite"));
}

const engineThatMustNeverBeCalled: EngineInvoker = {
  run: () => {
    throw new Error("judge is stubbed in this plan and must never call the engine");
  },
};

async function testAlwaysReturnsAgentReady(): Promise<void> {
  const db = openTestDb();
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "s", description: "d" });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });

  const ctx: PipelineContext = {
    db,
    runId: run.id,
    ticket,
    engine: engineThatMustNeverBeCalled,
    engineName: "fake",
    worktreePath: "/tmp/does-not-matter",
    baseCommit: "0000000000000000000000000000000000000000",
    implementTimeoutMs: 1000,
    verifyTimeoutMs: 1000,
  };

  const result = await judge(ctx);
  assert.equal(result.outcome, "agent_ready");
  console.log("PASS: testAlwaysReturnsAgentReady");
}

async function main(): Promise<void> {
  await testAlwaysReturnsAgentReady();
}

void main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './judge.js'`

- [ ] **Step 3: Write `src/pipeline/judge.ts`**

```typescript
import type { PipelineContext, JudgeResult } from "./types.js";

/**
 * Stubbed to always return agent-ready. The Phase 1 spec's real Judge
 * (agent call, blocklist cross-check, categorized needs-human) is deferred
 * until the readiness-scan piece exists to give it something real to judge
 * against — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md
 * "Judge is stubbed". This function still exists and is still called by
 * the orchestrator so that swapping in real logic later only touches this
 * one file.
 */
export async function judge(_ctx: PipelineContext): Promise<JudgeResult> {
  return { outcome: "agent_ready" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/pipeline/judge.test.js`
Expected: `PASS: testAlwaysReturnsAgentReady`

- [ ] **Step 5: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the Judge stage, stubbed to always return agent-ready until the readiness-scan piece exists (src/pipeline/judge.ts)
```

```bash
git add src/pipeline/judge.ts src/pipeline/judge.test.ts CHANGELOG.md
git commit -m "Add stubbed Judge stage"
```

---

### Task 5: Implement stage

**Files:**
- Create: `src/pipeline/implement.ts`
- Test: `src/pipeline/implement.test.ts`

**Interfaces:**
- Consumes: `PipelineContext`, `ImplementResult` (Task 1); `insertRunArtifact` (Task 2); `summarizeDiff`/`commitAll` (`src/git.ts`, unmodified); `listBlocklistEntries` (`src/db/blocklist.ts`)
- Produces: `implement(ctx: PipelineContext): Promise<ImplementResult>` — used by the orchestrator (Task 7)

- [ ] **Step 1: Write the failing test — `src/pipeline/implement.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { insertBlocklistEntry } from "../db/blocklist.js";
import { implement } from "./implement.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "implement-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

function initTestRepo(): { path: string; baseCommit: string } {
  const path = mkdtempSync(join(tmpdir(), "implement-test-repo-"));
  execSync("git init -q", { cwd: path });
  execSync("git config user.email test@example.com", { cwd: path });
  execSync("git config user.name Test", { cwd: path });
  writeFileSync(join(path, "README.md"), "hello\n");
  execSync("git add -A", { cwd: path });
  execSync("git commit -q -m initial", { cwd: path });
  const baseCommit = execSync("git rev-parse HEAD", { cwd: path }).toString().trim();
  return { path, baseCommit };
}

function makeContext(db: Database.Database, engine: EngineInvoker): PipelineContext {
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });
  const repo = initTestRepo();
  return {
    db,
    runId: run.id,
    ticket,
    engine,
    engineName: "fake",
    worktreePath: repo.path,
    baseCommit: repo.baseCommit,
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
  };
}

function makeEngine(behavior: (options: EngineRunOptions) => Promise<EngineRunResult>): EngineInvoker {
  return { run: behavior };
}

async function testCommitsChangesWhenAgentWritesCode(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      writeFileSync(join(options.cwd, "feature.txt"), "new feature\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "changes_committed");

  const log = execSync("git log --oneline", { cwd: ctx.worktreePath }).toString();
  assert.equal(log.trim().split("\n").length, 2, "expected the initial commit plus one new commit");
  console.log("PASS: testCommitsChangesWhenAgentWritesCode");
}

async function testReturnsNoChangesWhenAgentDoesNothing(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async () => ({
      outcome: "ok",
      finalText: "done",
      transcript: ["done"],
      durationSec: 0.1,
      exitCode: 0,
    })),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "no_changes");
  console.log("PASS: testReturnsNoChangesWhenAgentDoesNothing");
}

async function testReturnsNeedsHumanOnBlocklistHit(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      writeFileSync(join(options.cwd, "secrets.env"), "API_KEY=x\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );
  insertBlocklistEntry(db, { pattern: "secrets.env", reason: "never touch secrets", source: "human" });

  const result = await implement(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "forbidden_path_or_action");

  const log = execSync("git log --oneline", { cwd: ctx.worktreePath }).toString();
  assert.equal(log.trim().split("\n").length, 1, "blocklist hit must not be committed");
  console.log("PASS: testReturnsNeedsHumanOnBlocklistHit");
}

async function testReturnsTimeoutOutcome(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async () => ({
      outcome: "timeout",
      finalText: "",
      transcript: [],
      durationSec: 5,
      exitCode: null,
    })),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "implement_timeout");
  assert.equal(result.needsHumanCategory, null);
  console.log("PASS: testReturnsTimeoutOutcome");
}

async function main(): Promise<void> {
  await testCommitsChangesWhenAgentWritesCode();
  await testReturnsNoChangesWhenAgentDoesNothing();
  await testReturnsNeedsHumanOnBlocklistHit();
  await testReturnsTimeoutOutcome();
}

void main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './implement.js'`

- [ ] **Step 3: Write `src/pipeline/implement.ts`**

```typescript
import { summarizeDiff, commitAll } from "../git.js";
import { listBlocklistEntries } from "../db/blocklist.js";
import { insertRunArtifact } from "../db/run-artifacts.js";
import type { PipelineContext, ImplementResult } from "./types.js";
import type { Ticket } from "../db/tickets.js";

function buildImplementPrompt(ticket: Ticket): string {
  return [
    `Ticket ${ticket.key}: ${ticket.summary}`,
    "",
    ticket.description,
    "",
    "Implement this ticket directly in the current working directory. Make whatever code changes are needed to satisfy it. Do not produce a plan or ask for approval — make the change directly.",
  ].join("\n");
}

interface BlocklistHit {
  file: string;
  pattern: string;
  reason: string;
}

/**
 * Pattern is a path prefix, with `*` supported as a single-path-segment
 * wildcard. Deliberately simple — the blocklist has to be human-readable
 * and auditable, not its own pattern language.
 */
function matchesBlocklistPattern(file: string, pattern: string): boolean {
  const normalized = file.replace(/^\.\//, "");
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}`).test(normalized);
  }
  return normalized === pattern || normalized.startsWith(pattern);
}

function findBlocklistHit(
  files: string[],
  entries: { pattern: string; reason: string }[],
): BlocklistHit | null {
  for (const file of files) {
    for (const entry of entries) {
      if (matchesBlocklistPattern(file, entry.pattern)) {
        return { file, pattern: entry.pattern, reason: entry.reason };
      }
    }
  }
  return null;
}

/**
 * Real agent invocation with cwd-confined shell access (no additional
 * sandboxing beyond the worktree directory). Blocklist enforcement here is
 * the only safety net while Judge is stubbed — see judge.ts and the design
 * doc's "Outcome model" section.
 */
export async function implement(ctx: PipelineContext): Promise<ImplementResult> {
  const engineResult = await ctx.engine.run({
    prompt: buildImplementPrompt(ctx.ticket),
    cwd: ctx.worktreePath,
    timeoutMs: ctx.implementTimeoutMs,
  });

  insertRunArtifact(ctx.db, {
    runId: ctx.runId,
    kind: "implement_transcript",
    content: engineResult.transcript.join("\n"),
  });

  if (engineResult.outcome === "timeout") {
    return {
      outcome: "implement_timeout",
      needsHumanCategory: null,
      needsHumanReason: `implement exceeded its ${String(ctx.implementTimeoutMs / 1000)}s timeout`,
    };
  }
  if (engineResult.outcome === "process_error") {
    return {
      outcome: "implement_error",
      needsHumanCategory: null,
      needsHumanReason: "the implement engine process failed to run",
    };
  }
  if (engineResult.outcome === "nonzero_exit") {
    return {
      outcome: "implement_nonzero_exit",
      needsHumanCategory: null,
      needsHumanReason: `the implement engine exited with code ${String(engineResult.exitCode)}`,
    };
  }

  const diff = await summarizeDiff(ctx.worktreePath, ctx.baseCommit);
  insertRunArtifact(ctx.db, { runId: ctx.runId, kind: "diff_patch", content: diff.patch });

  if (diff.filesChanged === 0) {
    return {
      outcome: "no_changes",
      needsHumanCategory: null,
      needsHumanReason: "the agent made no changes to the worktree",
    };
  }

  const blocklist = listBlocklistEntries(ctx.db);
  const hit = findBlocklistHit(
    diff.stats.map((s) => s.file),
    blocklist,
  );
  if (hit) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "forbidden_path_or_action",
      needsHumanReason: `changed file "${hit.file}" matches blocklist pattern "${hit.pattern}" (${hit.reason})`,
    };
  }

  await commitAll(
    ctx.worktreePath,
    `[${ctx.ticket.key}] ${ctx.ticket.summary}\n\nImplemented by agent (${ctx.engineName}). Needs human review.`,
  );

  return { outcome: "changes_committed", needsHumanCategory: null, needsHumanReason: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/pipeline/implement.test.js`
Expected: all four `PASS:` lines print.

- [ ] **Step 5: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the Implement stage: real agent invocation, diff-time blocklist enforcement, and branch commit (src/pipeline/implement.ts)
```

```bash
git add src/pipeline/implement.ts src/pipeline/implement.test.ts CHANGELOG.md
git commit -m "Add Implement stage"
```

---

### Task 6: Verify stage

**Files:**
- Create: `src/pipeline/verify.ts`
- Test: `src/pipeline/verify.test.ts`

**Interfaces:**
- Consumes: `PipelineContext`, `VerifyResult` (Task 1); `insertRunArtifact` (Task 2); `exec` (`src/proc.ts`, unmodified); `getLatestReadinessScan` (`src/db/readiness-scans.ts`)
- Produces: `verify(ctx: PipelineContext): Promise<VerifyResult>` — used by the orchestrator (Task 7)

- [ ] **Step 1: Write the failing test — `src/pipeline/verify.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import { verify } from "./verify.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "verify-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

const unusedEngine: EngineInvoker = {
  run: () => {
    throw new Error("verify must never call the agent engine");
  },
};

function makeContext(db: Database.Database): PipelineContext {
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "changes_committed",
    startedAt: new Date().toISOString(),
  });
  return {
    db,
    runId: run.id,
    ticket,
    engine: unusedEngine,
    engineName: "fake",
    worktreePath: process.cwd(),
    baseCommit: "0000000000000000000000000000000000000000",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
  };
}

function seedTestCommand(db: Database.Database, testCommand: string): void {
  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand,
    areaSignals: null,
    status: "completed",
  });
}

async function testReturnsNeedsHumanWhenNoReadinessScan(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "weak_verification");
  console.log("PASS: testReturnsNeedsHumanWhenNoReadinessScan");
}

async function testReturnsReadyForPrWhenTestCommandExitsZero(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "true");
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "ready_for_pr");
  console.log("PASS: testReturnsReadyForPrWhenTestCommandExitsZero");
}

async function testReturnsVerifyFailedWhenTestCommandExitsNonzero(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "false");
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "verify_failed");
  console.log("PASS: testReturnsVerifyFailedWhenTestCommandExitsNonzero");
}

async function testReturnsVerifyTimeoutWhenCommandHangs(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "sleep 5");
  const ctx: PipelineContext = { ...makeContext(db), verifyTimeoutMs: 100 };

  const result = await verify(ctx);
  assert.equal(result.outcome, "verify_timeout");
  console.log("PASS: testReturnsVerifyTimeoutWhenCommandHangs");
}

async function main(): Promise<void> {
  await testReturnsNeedsHumanWhenNoReadinessScan();
  await testReturnsReadyForPrWhenTestCommandExitsZero();
  await testReturnsVerifyFailedWhenTestCommandExitsNonzero();
  await testReturnsVerifyTimeoutWhenCommandHangs();
}

void main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './verify.js'`

- [ ] **Step 3: Write `src/pipeline/verify.ts`**

```typescript
import { exec } from "../proc.js";
import { getLatestReadinessScan } from "../db/readiness-scans.js";
import { insertRunArtifact } from "../db/run-artifacts.js";
import type { PipelineContext, VerifyResult } from "./types.js";

/**
 * Runs the readiness scan's recorded test command as a plain child process
 * — never through EngineInvoker, since this is a shell command, not an
 * agent call. Exit code only, per the Phase 1 spec's "Verify: exit-code
 * only" architecture decision. The missing-test-command check below is
 * normally Judge's job (see judge.ts) but lives here while Judge is
 * stubbed — see the design doc's "Outcome model" section.
 */
export async function verify(ctx: PipelineContext): Promise<VerifyResult> {
  const scan = getLatestReadinessScan(ctx.db);
  const testCommand = scan?.testCommand?.trim() ?? "";

  if (testCommand.length === 0) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "weak_verification",
      needsHumanReason: "no readiness scan has recorded a test command yet",
    };
  }

  const parts = testCommand.split(/\s+/);
  const bin = parts[0];
  if (bin === undefined) {
    return {
      outcome: "needs_human",
      needsHumanCategory: "weak_verification",
      needsHumanReason: "recorded test command is empty",
    };
  }
  const args = parts.slice(1);

  const result = await exec(bin, args, {
    cwd: ctx.worktreePath,
    timeoutMs: ctx.verifyTimeoutMs,
  });

  insertRunArtifact(ctx.db, {
    runId: ctx.runId,
    kind: "verify_output",
    content: `${result.stdout}\n--- stderr ---\n${result.stderr}`,
  });

  if (result.timedOut) {
    return {
      outcome: "verify_timeout",
      needsHumanCategory: null,
      needsHumanReason: `test command exceeded its ${String(ctx.verifyTimeoutMs / 1000)}s timeout`,
    };
  }

  if (result.exitCode === 0) {
    return { outcome: "ready_for_pr", needsHumanCategory: null, needsHumanReason: null };
  }

  return {
    outcome: "verify_failed",
    needsHumanCategory: null,
    needsHumanReason: `test command exited with code ${String(result.exitCode)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/pipeline/verify.test.js`
Expected: all four `PASS:` lines print.

- [ ] **Step 5: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the Verify stage: readiness-scan test command lookup and exit-code-only verification (src/pipeline/verify.ts)
```

```bash
git add src/pipeline/verify.ts src/pipeline/verify.test.ts CHANGELOG.md
git commit -m "Add Verify stage"
```

---

### Task 7: Orchestrator

**Files:**
- Create: `src/pipeline/run.ts`
- Test: `src/pipeline/run.test.ts`

**Interfaces:**
- Consumes: `judge` (Task 4), `implement` (Task 5), `verify` (Task 6), `PipelineConfig`/`loadPipelineConfig` (Task 3), `PipelineContext` (Task 1); `getTicketByKey` (`src/db/tickets.ts`), `insertRun`/`updateRun`/`Run` (`src/db/runs.ts`), `assertCleanRepo`/`createWorktree` (`src/git.ts`), `createEngineInvoker` (`src/engine/create-invoker.ts`)
- Produces: `runPipeline(ticketKey, config, db, engineOverride?): Promise<Run>` — the deliverable of this plan; nothing later in this plan consumes it, but it's what a future ticket-intake/CLI/UI piece will call

- [ ] **Step 1: Write the failing test — `src/pipeline/run.test.ts`**

```typescript
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import { runPipeline } from "./run.js";
import type { PipelineConfig } from "./config.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "run-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

function initTestRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "run-test-repo-"));
  execSync("git init -q -b main", { cwd: path });
  execSync("git config user.email test@example.com", { cwd: path });
  execSync("git config user.name Test", { cwd: path });
  writeFileSync(join(path, "README.md"), "hello\n");
  execSync("git add -A", { cwd: path });
  execSync("git commit -q -m initial", { cwd: path });
  return path;
}

function makeConfig(repoPath: string): PipelineConfig {
  return {
    repoPath,
    worktreeRoot: join(repoPath, ".worktrees"),
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "pty",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
  };
}

function makeEngine(behavior: (options: EngineRunOptions) => Promise<EngineRunResult>): EngineInvoker {
  return { run: behavior };
}

const engineWritesAFile = makeEngine(async (options) => {
  writeFileSync(join(options.cwd, "feature.txt"), "new feature\n");
  return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
});

const engineDoesNothing = makeEngine(async () => ({
  outcome: "ok",
  finalText: "done",
  transcript: ["done"],
  durationSec: 0.1,
  exitCode: 0,
}));

async function testFullRunReachesReadyForPr(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });

  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand: "true",
    areaSignals: null,
    status: "completed",
  });

  const run = await runPipeline("PROJ-1", makeConfig(repoPath), db, engineWritesAFile);

  assert.equal(run.outcome, "ready_for_pr");
  assert.ok(run.branch);
  assert.ok(run.worktreePath);
  assert.ok(run.finishedAt);
  console.log("PASS: testFullRunReachesReadyForPr");
}

async function testStopsAtNoChangesWithoutRunningVerify(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-2", summary: "Do nothing", description: "..." });
  // Deliberately no readiness scan seeded. If verify() ran anyway it would
  // return needs_human/weak_verification, not no_changes — so this also
  // proves verify() was never reached once implement reported no changes.

  const run = await runPipeline("PROJ-2", makeConfig(repoPath), db, engineDoesNothing);

  assert.equal(run.outcome, "no_changes");
  console.log("PASS: testStopsAtNoChangesWithoutRunningVerify");
}

async function testReachesVerifyFailedWhenTestsRed(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-3", summary: "Add widget", description: "..." });

  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand: "false",
    areaSignals: null,
    status: "completed",
  });

  const run = await runPipeline("PROJ-3", makeConfig(repoPath), db, engineWritesAFile);

  assert.equal(run.outcome, "verify_failed");
  console.log("PASS: testReachesVerifyFailedWhenTestsRed");
}

async function testThrowsForUnknownTicket(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();

  await assert.rejects(() => runPipeline("NOPE-1", makeConfig(repoPath), db, engineDoesNothing));
  console.log("PASS: testThrowsForUnknownTicket");
}

async function main(): Promise<void> {
  await testFullRunReachesReadyForPr();
  await testStopsAtNoChangesWithoutRunningVerify();
  await testReachesVerifyFailedWhenTestsRed();
  await testThrowsForUnknownTicket();
}

void main();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.json`
Expected: FAIL — `Cannot find module './run.js'`

- [ ] **Step 3: Write `src/pipeline/run.ts`**

```typescript
import type Database from "better-sqlite3";
import { getTicketByKey } from "../db/tickets.js";
import { insertRun, updateRun } from "../db/runs.js";
import type { Run } from "../db/runs.js";
import { assertCleanRepo, createWorktree } from "../git.js";
import { createEngineInvoker } from "../engine/create-invoker.js";
import type { EngineInvoker } from "../engine/types.js";
import { judge } from "./judge.js";
import { implement } from "./implement.js";
import { verify } from "./verify.js";
import type { PipelineConfig } from "./config.js";
import type { PipelineContext } from "./types.js";

/**
 * Runs Judge -> Implement -> Verify for one ticket against one freshly
 * created worktree, persisting to the `runs` row after every stage
 * transition. Stops (without error) as soon as a stage produces anything
 * other than "keep going" — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md.
 *
 * `engineOverride` exists purely for testability (see run.test.ts) — real
 * callers omit it and get the engine createEngineInvoker builds from
 * config.engineMode.
 */
export async function runPipeline(
  ticketKey: string,
  config: PipelineConfig,
  db: Database.Database,
  engineOverride?: EngineInvoker,
): Promise<Run> {
  const ticket = getTicketByKey(db, ticketKey);
  if (!ticket) {
    throw new Error(`No ticket found with key "${ticketKey}"`);
  }

  const engineName = `claude-code-${config.engineMode}`;
  const run = insertRun(db, {
    ticketKey,
    engine: engineName,
    outcome: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    await assertCleanRepo(config.repoPath);
    const branch = `${config.branchPrefix}${ticket.key}-${run.id.slice(0, 8)}`;
    const worktree = await createWorktree(
      config.repoPath,
      config.worktreeRoot,
      branch,
      config.baseBranch,
    );
    updateRun(db, run.id, {
      branch: worktree.branch,
      worktreePath: worktree.path,
      baseCommit: worktree.baseCommit,
    });

    const engine = engineOverride ?? createEngineInvoker(config.engineMode);
    const ctx: PipelineContext = {
      db,
      runId: run.id,
      ticket,
      engine,
      engineName,
      worktreePath: worktree.path,
      baseCommit: worktree.baseCommit,
      implementTimeoutMs: config.implementTimeoutMs,
      verifyTimeoutMs: config.verifyTimeoutMs,
    };

    const j = await judge(ctx);
    updateRun(db, run.id, { outcome: j.outcome });
    if (j.outcome !== "agent_ready") {
      return updateRun(db, run.id, { finishedAt: new Date().toISOString() });
    }

    const i = await implement(ctx);
    updateRun(db, run.id, {
      outcome: i.outcome,
      needsHumanCategory: i.needsHumanCategory,
      needsHumanReason: i.needsHumanReason,
    });
    if (i.outcome !== "changes_committed") {
      return updateRun(db, run.id, { finishedAt: new Date().toISOString() });
    }

    const v = await verify(ctx);
    return updateRun(db, run.id, {
      outcome: v.outcome,
      needsHumanCategory: v.needsHumanCategory,
      needsHumanReason: v.needsHumanReason,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    return updateRun(db, run.id, {
      outcome: "error",
      needsHumanReason: (err as Error).message,
      finishedAt: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.json && node dist/pipeline/run.test.js`
Expected: all four `PASS:` lines print.

- [ ] **Step 5: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed.

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Added the Pipeline shape orchestrator wiring Judge -> Implement -> Verify against a real ticket and worktree (src/pipeline/run.ts)
```

```bash
git add src/pipeline/run.ts src/pipeline/run.test.ts CHANGELOG.md
git commit -m "Add pipeline orchestrator"
```

---

### Task 8: Doc reconciliation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`
- Modify: `src/engine/create-invoker.ts` (comment only, no logic change)
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: nothing (docs/comments only)
- Produces: nothing consumed by other tasks — this is the plan's closing bookkeeping step

- [ ] **Step 1: Update the stale "headless is the default" wording in the Phase 1 spec**

In `docs/superpowers/specs/2026-08-02-phase-1-product-design.md`, find this line in the "Agent engine: switchable, not fixed" section:

```
- **Headless (`claude -p`, non-interactive)** — structured JSON output per line, no terminal emulation needed. **This is the default.**
```

Replace with:

```
- **Headless (`claude -p`, non-interactive)** — structured JSON output per line, no terminal emulation needed. **This was the initially recommended default; see `docs/superpowers/specs/2026-08-03-pipeline-shape-design.md` for why this instance's actual config now defaults to PTY instead.**
```

Then find this sentence later in the same section:

```
Headless was faster (10–16s vs 18–20s) and produces clean output with no ANSI-stripping needed, so it shipped first as the default, and does not require the PTY complexity to be built before anything can run.
```

Replace with:

```
Headless was faster (10–16s vs 18–20s) and produces clean output with no ANSI-stripping needed, so it shipped first as the initially recommended default, and does not require the PTY complexity to be built before anything can run. (This instance's actual config now defaults to PTY instead — see `docs/superpowers/specs/2026-08-03-pipeline-shape-design.md`.)
```

- [ ] **Step 2: Update the comment in `src/engine/create-invoker.ts`**

Find:

```typescript
/**
 * "headless" (claude -p) is the default across this project — see the
 * Phase 1 design doc's "Agent engine" section. "pty" is an explicit opt-in
 * for cost-durability reasons; nothing selects it automatically.
 */
```

Replace with:

```typescript
/**
 * "headless" (claude -p) was the Phase 1 design doc's initially recommended
 * default — see its "Agent engine" section. This instance's actual config
 * (src/pipeline/config.ts) defaults to "pty" instead; see
 * docs/superpowers/specs/2026-08-03-pipeline-shape-design.md. Either way,
 * this factory never auto-selects — the caller always passes an explicit
 * mode.
 */
```

- [ ] **Step 3: Update `docs/roadmap.md`'s Pipeline shape line**

Find:

```
- [ ] Pipeline shape (Judge → Implement → Verify → Open PR) — no plan yet
```

Replace with:

```
- [ ] Pipeline shape (Judge → Implement → Verify → Open PR) — partially done: Implement and Verify are built for real, Judge is stubbed to always agent-ready, and Open PR is out of scope (`docs/superpowers/plans/2026-08-03-pipeline-shape.md`) — real Judge logic and Open PR remain unplanned
```

- [ ] **Step 4: Full build + selftest**

Run: `npm run build && npm run selftest`
Expected: both succeed (this task changes no runtime logic, only comments/docs, so this is purely a regression check).

- [ ] **Step 5: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
- 2026-08-03: [pipeline-shape] | @potensio - Reconciled docs for the Pipeline shape piece: updated the stale headless-default wording and roadmap.md's Pipeline shape line to reflect what's actually built
```

```bash
git add docs/superpowers/specs/2026-08-02-phase-1-product-design.md src/engine/create-invoker.ts docs/roadmap.md CHANGELOG.md
git commit -m "Reconcile Pipeline shape docs with what's actually built"
```
