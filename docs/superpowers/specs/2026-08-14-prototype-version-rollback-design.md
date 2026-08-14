# Prototype Version Rollback (via chat) — Design Spec

**Date:** 2026-08-14
**Status:** Approved for planning

## Goal

Add version history to the prototype builder so a user can roll the preview
back to a previous generated version (or forward to the latest) by typing a
natural-language command in the iterate/chat instruction box. The preview link
(shareId) stays the same forever — no new link per version.

## Scope

- Applies to the **prototype builder** (`/api/prototypes` + iterate panel).
- Trigger is **chat-only** for now (no dedicated version-history UI browser).
- Append-only versions; nothing is deleted (user chose "keep all").

## Model (git-checkout-like)

- Each successful `generatePrototype` (initial create + every regenerate) creates
  a new **version** (v1, v2, v3, …).
- `prototypes.currentVersion` is the pointer to the version currently served.
- Rollback **moves the pointer**; it does not create a version and never deletes one.
- `prototype_files` always holds the **active** version's files (what `/p/:shareId/`
  serves). Rollback restores the target version's files into `prototype_files`.
- The preview link (`shareId`) is unchanged.

## Behavior Matrix

| Instruction intent | Action |
|--------------------|--------|
| `rollback` / `versi sebelumnya` / `versi sebelum` / `balikin versi` / `undo` | currentVersion = max(1, currentVersion - 1); restore that version's files |
| `versi latest` / `versi terbaru` / `balik ke latest` / `latest` | currentVersion = latest version; restore its files |
| anything else | normal regenerate (append instruction to brief → generate → new version) |
| "previous" while already at v1 | no-op, return a message ("already at oldest version") |
| rollback on a prototype with no versions yet | no-op, return a message |

## Data Model

### `prototypes` (add column)

```ts
currentVersion: integer("current_version").notNull().default(1),
```

### New table `prototype_versions`

```ts
export const prototypeVersions = pgTable(
  "prototype_versions",
  {
    id: serial("id").primaryKey(),
    prototypeId: text("prototype_id").notNull().references(() => prototypes.id),
    version: integer("version").notNull(),
    files: jsonb("files").notNull(), // Record<path, content>
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

## Storage Functions (`storage.ts`)

```ts
export interface PrototypeVersion {
  id: number;
  prototypeId: string;
  version: number;
  files: Record<string, string>;
  createdAt: Date;
}

export async function snapshotVersion(db, prototypeId, files: { path: string; content: string }[]): Promise<number>;
export async function getLatestVersion(db, prototypeId): Promise<number | null>;
export async function getVersionFiles(db, prototypeId, version): Promise<{ path: string; content: string }[] | null>;
export async function restoreVersion(db, prototypeId, version): Promise<number>;
```

- `snapshotVersion`: read max version, insert `max+1` with `files` JSON, set
  `prototypes.currentVersion = max+1`, return the new version number.
- `restoreVersion`: load the version's `files`, upsert each into `prototype_files`,
  set `currentVersion = version`, return `version`.

## Rollback Intent (`rollback.ts`, new)

```ts
export function parseRollbackIntent(instruction: string): "previous" | "latest" | null;
```

Case-insensitive keyword match:
- **previous**: `rollback`, `versi sebelumnya`, `versi sebelum`, `balikin versi`, `kembalikan versi`, `undo`.
- **latest**: `latest`, `versi latest`, `versi terbaru`, `balik ke latest`, `kembali ke versi terbaru`.
- Returns `null` otherwise (normal regenerate path).

## Route Changes (`routes.ts`)

In `POST /api/prototypes/:id/regenerate`:

1. Parse `body.instruction`.
2. `intent = parseRollbackIntent(instruction ?? "")`.
3. If `previous`:
   - `latest = getLatestVersion(db, id)`; if `!latest` → `{ action: "rollback", version: null, message: "no versions yet" }`.
   - `current = proto.currentVersion`; `target = Math.max(1, current - 1)`.
   - `restoreVersion(db, id, target)` → `{ action: "rollback", version: target }`.
4. If `latest`:
   - `latest = getLatestVersion(db, id)`; if `!latest` → no-op response.
   - `restoreVersion(db, id, latest)` → `{ action: "rollback", version: latest }`.
5. Else: existing regenerate flow (append instruction, `generatePrototype`).

## Engine Change (`engine.ts`)

After the successful save loop in `generatePrototype` (before `status = done`):

```ts
await snapshotVersion(db, prototype.id, files);
```

## Frontend (`PrototypeView.tsx`)

- `Prototype` interface gains `currentVersion: number`.
- Header badge shows `v{active.currentVersion}` next to status.
- `regenerate()` branches on the response:
  - `{ action: "rollback", version }` → update `active.currentVersion`, bump `iframeKey`
    (reload preview), do **not** set status `generating`; show a brief "rolled back to vN" note.
  - `{ regenerating: true }` → existing behavior.

## Error Handling

- Rollback never calls the AI; it is a DB-only operation and must not fail generation.
- Rollback on a missing/empty prototype → 404 (existing).
- A failed/timed-out generation leaves no new version (snapshot only on success).

## Testing

- `parseRollbackIntent` — previous/latest/normal/null; case-insensitive.
- `snapshotVersion` + `restoreVersion` + `getLatestVersion` — version increments,
  files round-trip, pointer updates, "already at v1" no-op.
- Route: rollback returns `{ action: "rollback", version }`; normal instruction still regenerates.
- Live e2e — generate → regenerate → `rollback` → verify files match v(N-1) → `latest` → verify v(N) back.

## Out of Scope

- Dedicated version-history browser UI.
- Version eviction / retention limits (keep all).
- Incremental edits — regenerate still regenerates from the full brief, not from the
  currently-rolled-back files.
- Rollback for the chat-prototype (single-HTML) conversation flow.
