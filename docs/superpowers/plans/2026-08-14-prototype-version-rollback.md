# Prototype Version Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add append-only version snapshots to the prototype builder and a chat/iterate rollback command (`rollback` / `versi sebelumnya` / `latest`) that restores the preview to a previous or latest version without changing the preview link.

**Architecture:** A new `prototype_versions` table stores a JSON snapshot of every successful generation. `prototypes.currentVersion` points at the active version. `prototype_files` remains the "live" files that `/p/:shareId/` serves; rollback restores a snapshot into it. A pure `parseRollbackIntent` helper routes the iterate instruction.

**Tech Stack:** TypeScript (Node 22, ESM), Drizzle ORM + PostgreSQL, React 19.

## Global Constraints

- Server is ESM, `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `rootDir: apps/server`, `outDir: dist`.
- Tests use `node:test` + `node:assert/strict`, run via `node --test dist/**/*.test.js` after `tsc`.
- Drizzle migrations are generated via `drizzle-kit` and auto-run on `openDb` startup.
- The preview link (`shareId`) must never change; no new URL per version.
- Rollback is DB-only (no AI call) and must never fail a generation.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/db/schema.ts` | Modify | `currentVersion` column + `prototypeVersions` table |
| `apps/server/db/drizzle/*` | Create | generated migration |
| `apps/server/prototype/rollback.ts` | Create | `parseRollbackIntent` (pure) |
| `apps/server/prototype/rollback.test.ts` | Create | intent tests |
| `apps/server/prototype/storage.ts` | Modify | version snapshot/restore functions |
| `apps/server/prototype/engine.ts` | Modify | snapshot after successful generation |
| `apps/server/prototype/routes.ts` | Modify | rollback intent handling in regenerate |
| `apps/web/src/components/PrototypeView.tsx` | Modify | version badge + rollback response handling |

---

### Task 1: Schema + migration

**Files:**
- Modify: `apps/server/db/schema.ts`

- [ ] **Step 1: Add `jsonb` to the drizzle import**

In `apps/server/db/schema.ts`, change:

```typescript
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
```

to:

```typescript
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Add `currentVersion` to `prototypes`**

In the `prototypes` table, add the column after `status`:

```typescript
  status: text("status").notNull().default("generating"),
  currentVersion: integer("current_version").notNull().default(1),
```

- [ ] **Step 3: Add the `prototypeVersions` table**

Append after `prototypeFiles`:

```typescript
export const prototypeVersions = pgTable(
  "prototype_versions",
  {
    id: serial("id").primaryKey(),
    prototypeId: text("prototype_id")
      .notNull()
      .references(() => prototypes.id),
    version: integer("version").notNull(),
    files: jsonb("files").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (table) => ({
    uniqueVersion: uniqueIndex("idx_prototype_versions_version").on(
      table.prototypeId,
      table.version,
    ),
  }),
);
```

- [ ] **Step 4: Generate the migration**

```bash
DATABASE_URL=postgresql://localhost:5432/sandwich \
  npx drizzle-kit generate --config apps/server/drizzle.config.ts
```

Expected: a new migration file appears under `apps/server/db/drizzle/`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/db/schema.ts apps/server/db/drizzle
git commit -m "feat: prototype_versions table + currentVersion column"
```

---

### Task 2: `rollback.ts` intent parser

**Files:**
- Create: `apps/server/prototype/rollback.ts`
- Test: `apps/server/prototype/rollback.test.ts`

**Interfaces:**
- Produces: `parseRollbackIntent(instruction: string): "previous" | "latest" | null`.

- [ ] **Step 1: Write the failing test**

```typescript
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseRollbackIntent } from "./rollback.js";

describe("parseRollbackIntent", () => {
  it("detects previous", () => {
    assert.equal(parseRollbackIntent("rollback"), "previous");
    assert.equal(parseRollbackIntent("balikin versi sebelumnya"), "previous");
    assert.equal(parseRollbackIntent("versi sebelum"), "previous");
    assert.equal(parseRollbackIntent("UNDO"), "previous");
  });

  it("detects latest", () => {
    assert.equal(parseRollbackIntent("latest"), "latest");
    assert.equal(parseRollbackIntent("balik ke versi latest"), "latest");
    assert.equal(parseRollbackIntent("versi terbaru"), "latest");
  });

  it("returns null for normal instructions", () => {
    assert.equal(parseRollbackIntent("ubah warna tombol jadi merah"), null);
    assert.equal(parseRollbackIntent(""), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/rollback.test.js
```

Expected: FAIL — `Cannot find module './rollback.js'`.

- [ ] **Step 3: Write the module**

```typescript
export type RollbackIntent = "previous" | "latest";

const LATEST = [
  "versi latest",
  "versi terbaru",
  "balik ke latest",
  "kembali ke versi terbaru",
  "kembali ke latest",
  "latest",
];

const PREVIOUS = [
  "versi sebelumnya",
  "versi sebelum",
  "balikin versi",
  "balikan versi",
  "kembalikan versi",
  "rollback",
  "undo",
];

export function parseRollbackIntent(instruction: string): RollbackIntent | null {
  const s = instruction.toLowerCase();
  if (LATEST.some((p) => s.includes(p))) return "latest";
  if (PREVIOUS.some((p) => s.includes(p))) return "previous";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/rollback.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/rollback.ts apps/server/prototype/rollback.test.ts
git commit -m "feat: rollback intent parser"
```

---

### Task 3: Version storage functions

**Files:**
- Modify: `apps/server/prototype/storage.ts`

**Interfaces:**
- Produces: `snapshotVersion(db, prototypeId, files): Promise<number>`, `getLatestVersion(db, prototypeId): Promise<number | null>`, `getVersionFiles(db, prototypeId, version): Promise<{ path; content }[] | null>`, `restoreVersion(db, prototypeId, version): Promise<number>`.
- Consumes: `prototypeVersions` from `./schema.js`; existing `savePrototypeFile`.

- [ ] **Step 1: Update imports + `Prototype` interface**

In `storage.ts`, change the schema import to also import `prototypeVersions`, and add `currentVersion: number` to `Prototype`:

```typescript
import { prototypes, prototypeFiles, prototypeVersions } from "./schema.js";
```

- [ ] **Step 2: Add the functions**

Append:

```typescript
export interface PrototypeVersion {
  id: number;
  prototypeId: string;
  version: number;
  files: Record<string, string>;
  createdAt: Date;
}

export async function snapshotVersion(
  db: Database,
  prototypeId: string,
  files: { path: string; content: string }[],
): Promise<number> {
  const rows = await db.select().from(prototypeVersions).where(eq(prototypeVersions.prototypeId, prototypeId));
  const maxVersion = rows.reduce((m, r) => Math.max(m, r.version), 0);
  const version = maxVersion + 1;
  const filesObj: Record<string, string> = {};
  for (const f of files) filesObj[f.path] = f.content;
  const now = new Date();
  await db.insert(prototypeVersions).values({
    prototypeId,
    version,
    files: filesObj,
    createdAt: now,
  });
  await db.update(prototypes).set({ currentVersion: version, updatedAt: now }).where(eq(prototypes.id, prototypeId));
  return version;
}

export async function getLatestVersion(db: Database, prototypeId: string): Promise<number | null> {
  const rows = await db.select().from(prototypeVersions).where(eq(prototypeVersions.prototypeId, prototypeId));
  if (rows.length === 0) return null;
  return rows.reduce((m, r) => Math.max(m, r.version), 0);
}

export async function getVersionFiles(
  db: Database,
  prototypeId: string,
  version: number,
): Promise<{ path: string; content: string }[] | null> {
  const rows = await db
    .select()
    .from(prototypeVersions)
    .where(and(eq(prototypeVersions.prototypeId, prototypeId), eq(prototypeVersions.version, version)))
    .limit(1);
  if (rows.length === 0) return null;
  const files = rows[0]!.files;
  return Object.entries(files).map(([path, content]) => ({ path, content: String(content) }));
}

export async function restoreVersion(db: Database, prototypeId: string, version: number): Promise<number> {
  const files = await getVersionFiles(db, prototypeId, version);
  if (!files) throw new Error(`prototype version ${version} not found`);
  for (const f of files) {
    await savePrototypeFile(db, prototypeId, f.path, f.content);
  }
  await db.update(prototypes).set({ currentVersion: version, updatedAt: new Date() }).where(eq(prototypes.id, prototypeId));
  return version;
}
```

> Ensure `and` and `eq` are already imported from `drizzle-orm` in `storage.ts` (they are, from the existing `getPrototypeFile`).

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/prototype/storage.ts
git commit -m "feat: prototype version snapshot + restore storage"
```

---

### Task 4: Engine snapshot + route rollback

**Files:**
- Modify: `apps/server/prototype/engine.ts`
- Modify: `apps/server/prototype/routes.ts`

- [ ] **Step 1: Snapshot after generation (engine.ts)**

In `engine.ts`, after the save loop and before `updatePrototypeStatus(..., "done")`, add:

```typescript
    await snapshotVersion(db, prototype.id, files);
```

And import `snapshotVersion` from `./storage.js`.

- [ ] **Step 2: Route rollback handling (routes.ts)**

Import:

```typescript
import { getLatestVersion, restoreVersion } from "./storage.js";
import { parseRollbackIntent } from "./rollback.js";
```

In `POST /api/prototypes/:id/regenerate`, after reading `body`, insert BEFORE the `updatedBrief` logic:

```typescript
    const intent = parseRollbackIntent(body?.instruction ?? "");
    if (intent === "previous") {
      const latest = await getLatestVersion(db, proto.id);
      if (!latest) {
        sendJson(res, 200, { action: "rollback", version: null, message: "no versions yet" });
        return;
      }
      const target = Math.max(1, proto.currentVersion - 1);
      await restoreVersion(db, proto.id, target);
      sendJson(res, 200, { action: "rollback", version: target });
      return;
    }
    if (intent === "latest") {
      const latest = await getLatestVersion(db, proto.id);
      if (!latest) {
        sendJson(res, 200, { action: "rollback", version: null, message: "no versions yet" });
        return;
      }
      await restoreVersion(db, proto.id, latest);
      sendJson(res, 200, { action: "rollback", version: latest });
      return;
    }
```

- [ ] **Step 3: Typecheck + full suite**

```bash
npx tsc -p tsconfig.json --noEmit && npm test
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/prototype/engine.ts apps/server/prototype/routes.ts
git commit -m "feat: snapshot versions + rollback route handling"
```

---

### Task 5: Frontend

**Files:**
- Modify: `apps/web/src/components/PrototypeView.tsx`

- [ ] **Step 1: Add `currentVersion` to the interface**

```typescript
interface Prototype {
  id: string;
  shareId: string;
  name: string;
  brief: string;
  status: string;
  createdAt: string;
  currentVersion?: number;
  previewUrl?: string;
}
```

- [ ] **Step 2: Show version badge in the header**

Next to the status badge, add:

```tsx
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4338ca" }}>
            v{active.currentVersion ?? 1}
          </span>
```

- [ ] **Step 3: Handle rollback response in `regenerate()`**

Replace the `regenerate` function's success path so it branches:

```typescript
    try {
      const res = await fetch(apiUrl(`/api/prototypes/${active.id}/regenerate`), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      const data = await res.json();
      if (data.action === "rollback") {
        setInstruction("");
        setRefreshing(false);
        setIframeKey((k) => k + 1);
        setActive({ ...active, currentVersion: data.version ?? 1 });
        return;
      }
      setInstruction("");
      setActive({ ...active, status: "generating" });
    } catch {
      setRefreshing(false);
    }
```

- [ ] **Step 4: Typecheck web**

```bash
npm --prefix apps/web run typecheck 2>&1 | tail -5 || true
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PrototypeView.tsx
git commit -m "feat: prototype version badge + rollback response handling"
```

---

### Task 6: Live e2e verification

- [ ] **Step 1: Run full suite**

```bash
npm test
```

Expected: `# fail 0`.

- [ ] **Step 2: Live e2e (needs Postgres + API key)**

Script: create a prototype, generate (v1), regenerate (v2), call regenerate with
`{ instruction: "rollback" }` → expect `{ action: "rollback", version: 1 }` and
`prototype_files` restored to v1; then `{ instruction: "latest" }` → `version: 2`.
Verify `shareId` never changes. Clean up test rows.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: e2e verification fixes"
```

---

## Self-Review

- **Spec coverage:** schema (Task 1), intent parser (Task 2), storage (Task 3), engine + route (Task 4), frontend (Task 5), e2e (Task 6). Behavior matrix covered.
- **Placeholder scan:** none — concrete code in every step.
- **Type consistency:** `parseRollbackIntent(instruction)`, `snapshotVersion(db, id, files)`, `getLatestVersion(db, id)`, `getVersionFiles(db, id, version)`, `restoreVersion(db, id, version)`; `prototype.currentVersion`; `{ action: "rollback", version }`. Consistent across tasks.
