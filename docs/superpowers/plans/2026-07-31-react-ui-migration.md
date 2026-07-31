# React UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file vanilla-JS `web/index.html` (569 lines, global mutable state, manual `innerHTML` string templating) with a React + TypeScript + Vite frontend split into per-component modules, with zero change to the backend API contract.

**Architecture:** `web/` becomes its own Vite+React+TS project with an independent `package.json`/`tsconfig.json` (not an npm workspace of root). It builds to `web/dist/`, which the existing `src/server.ts` already serves generically via its `webRoot` static-file option — only the `webRoot` default in `src/cli.ts` changes. All view logic currently in `render*()` functions moves 1:1 into React components; state currently in global `S`/`tab`/`openRun`/`sel` moves into a `useAppState()` hook plus local `useState` in `App.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, `@vitejs/plugin-react`. No state-management library beyond built-in hooks.

## Global Constraints

- Root `package.json` (orchestrator) dependency list does not change — still only `typescript` + `@types/node`. All new dependencies (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`) go in `web/package.json` only.
- `web/` has its own `npm install` — not an npm workspace, no linking to root `package.json`.
- Backend contract (`/api/*` routes in `src/server.ts`) does not change at all in this plan. No new endpoints, no response shape changes.
- `src/server.ts` itself is not modified — it already serves any `webRoot` generically. Only `src/cli.ts`'s `webRoot` default changes from `resolve("web")` to `resolve("web/dist")`.
- All UI copy (tab labels, buttons, hints, outcome labels) is written in **English**, not translated 1:1 from the current Indonesian strings — this is new text for a from-scratch component, not a port of existing text.
- Visual design/CSS is not redesigned — `web/src/styles.css` carries over the existing rules verbatim (selectors may be renamed to match component structure, but colors/spacing/layout stay the same).
- `tsconfig.json` in `web/` mirrors the strictness of the root one: `strict: true`, `noUncheckedIndexedAccess: true`.
- No new test framework is introduced. Verification is manual in-browser per task and a final full pass (Task 12).

---

### Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a working `web/` project buildable with `npm run build` (inside `web/`) to `web/dist/`, and runnable with `npm run dev` on port 5173.

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "runchise-agent-pipeline-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `web/tsconfig.node.json`** (for `vite.config.ts` itself)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4319",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 5: Create `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agent pipeline — Runchise</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create placeholder `web/src/App.tsx`** (real content added in Task 5)

```tsx
export default function App() {
  return <div>Loading…</div>;
}
```

- [ ] **Step 8: Create empty `web/src/styles.css`** (filled in Task 6)

```css
/* populated in Task 6 */
```

- [ ] **Step 9: Add `web/dist/` and `web/node_modules/` to `.gitignore`**

Modify `.gitignore` (currently 7 lines: `node_modules/`, `dist/`, `.work/`, `runs/`, `queue.json`, `*.log`, `.DS_Store`) to add:

```
web/node_modules/
web/dist/
```

- [ ] **Step 10: Install and verify standalone build**

Run: `cd web && npm install && npm run build`
Expected: succeeds, produces `web/dist/index.html` and `web/dist/assets/*.js`.

Run: `cd web && npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173/`); opening it shows "Loading…".

- [ ] **Step 11: Commit**

```bash
git add web/package.json web/tsconfig.json web/tsconfig.node.json web/vite.config.ts web/index.html web/src/main.tsx web/src/App.tsx web/src/styles.css .gitignore
git commit -m "Scaffold Vite + React + TypeScript project in web/"
```

---

### Task 2: Wire the built frontend into the existing backend

**Files:**
- Modify: `src/cli.ts:183`
- Modify: `package.json` (root)

**Interfaces:**
- Consumes: `web/dist/` produced by Task 1's `npm run build`.
- Produces: `node dist/cli.js serve` serves `web/dist/index.html` at `http://127.0.0.1:4319/`.

- [ ] **Step 1: Change the `webRoot` default in `src/cli.ts`**

In `cmdServe` (`src/cli.ts:176-186`), change:

```ts
    webRoot: resolve("web"),
```

to:

```ts
    webRoot: resolve("web/dist"),
```

- [ ] **Step 2: Extend root `package.json` scripts**

Modify the `"scripts"` block in root `package.json` (currently has `build`, `typecheck`, `selftest`, `run:queue`, `dashboard`, `doctor`) to add a `dev:web` script and extend `build`:

```json
"build": "tsc -p tsconfig.json && npm --prefix web run build",
"dev:web": "npm --prefix web run dev"
```

(Keep every other existing script unchanged.)

- [ ] **Step 3: Verify end-to-end**

Run: `npm run build`
Expected: `tsc` compiles the orchestrator to `dist/`, then `vite build` runs inside `web/`, producing `web/dist/`.

Run: `node dist/cli.js serve`
Expected: console prints `Web     : /path/to/web/dist/index.html`. Open `http://127.0.0.1:4319/` in a browser — shows "Loading…" (same placeholder from Task 1, now served through the real backend instead of Vite's dev server).

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts package.json
git commit -m "Point backend webRoot at web/dist, extend build script"
```

---

### Task 3: Shared types and API client

**Files:**
- Create: `web/src/types.ts`
- Create: `web/src/api.ts`

**Interfaces:**
- Produces:
  - Types: `Lane`, `Outcome`, `RspecResult`, `RunRecord`, `Job`, `JobKind`, `JobState`, `Metrics`, `Limits`, `LaneRules`, `BlocklistEntry`, `TicketInput`, `StateResponse`, `ConfigResponse`, `LaneInfo`, `RunDetailResponse` — all exported from `web/src/types.ts`.
  - Function: `api<T>(path: string, method?: string, body?: unknown): Promise<T>` exported from `web/src/api.ts`.
- Consumes: nothing (this is the foundation layer every later task imports from).

- [ ] **Step 1: Create `web/src/types.ts`**

Mirrors `src/types.ts`, `src/jobs.ts`, and `src/dashboard.ts`'s `Metrics` interface on the backend, plus the response shapes assembled by `src/server.ts`'s `/api/state`, `/api/config`, and `/api/runs/:ticket/:runId` handlers.

```ts
export type Lane = 1 | 2 | 3;

export interface TicketInput {
  key: string;
  summary: string;
  description: string;
  url?: string;
}

export type Outcome =
  | "plan_failed"
  | "plan_timeout"
  | "plan_out_of_scope"
  | "awaiting_plan_approval"
  | "plan_rejected"
  | "implementing"
  | "no_changes"
  | "guardrail_blocked"
  | "tests_failed"
  | "ready_for_review"
  | "error";

export interface RspecResult {
  ran: boolean;
  exitCode: number | null;
  timedOut: boolean;
  targets: string[];
  exampleCount: number | null;
  failureCount: number | null;
  pendingCount: number | null;
  durationSec: number | null;
}

export interface RunRecord {
  runId: string;
  ticket: string;
  ticketUrl: string | null;
  engine: string;
  lane: Lane | null;
  outcome: Outcome;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  branch: string;
  worktreePath: string | null;
  baseCommit: string | null;
  plannedFiles: string[];
  filesChanged: number;
  diffLines: number;
  addedTestFiles: number;
  violations: string[];
  blockedBy: string[];
  rspec: RspecResult | null;
  humanEditedLines: number | null;
  reviewRounds: number | null;
  merged: boolean | null;
  notes: string | null;
}

export type JobKind = "plan" | "implement";
export type JobState = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  kind: JobKind;
  ticket: string;
  runId: string | null;
  state: JobState;
  step: string;
  detail: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface Metrics {
  total: number;
  readyForReview: number;
  attemptSuccessRate: number | null;
  autonomyRate: number | null;
  autonomyDenominator: number;
  medianDurationSec: number | null;
  byOutcome: Array<[string, number]>;
  byLane: Array<[string, number]>;
}

export interface Limits {
  maxFilesChanged: number;
  maxDiffLines: number;
  planTimeoutMs: number;
  implementTimeoutMs: number;
  rspecTimeoutMs: number;
  maxCiRetries: number;
}

export interface LaneRules {
  lane1Enabled: boolean;
  lane1MaxDiffLines: number;
  lane1RequiresNewTests: boolean;
  coveredPathPrefixes: string[];
}

export interface BlocklistEntry {
  pattern: string;
  reason: string;
}

export interface StateConfigSummary {
  engine: string;
  repoPath: string;
  baseBranch: string;
  limits: Limits;
  laneRules: LaneRules;
  blocklistCount: number;
}

export interface StateResponse {
  tickets: TicketInput[];
  runs: RunRecord[];
  jobs: Job[];
  metrics: Metrics;
  config: StateConfigSummary;
}

export interface LaneInfo {
  lane: Lane;
  label: string;
}

export interface ConfigResponse {
  limits: Limits;
  laneRules: LaneRules;
  blocklist: BlocklistEntry[];
  engine: string;
  lanes: LaneInfo[];
}

export interface RunDetailResponse {
  record: RunRecord;
  plan: string | null;
  diff: string | null;
  agentOutput: string | null;
  files: string | null;
  toolCalls: string | null;
}
```

- [ ] **Step 2: Create `web/src/api.ts`**

Ports the `api()` function from the old `web/index.html` (`fetch` wrapper, JSON parse, throw on non-OK response) with a generic return type.

```ts
export async function api<T>(path: string, method?: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: method ?? "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${String(res.status)}`;
    throw new Error(message);
  }
  return data as T;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd web && npm run typecheck`
Expected: no errors (these files aren't imported yet, but must be self-consistent).

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "Add frontend types and API client"
```

---

### Task 4: `useAppState` hook — load + SSE refresh

**Files:**
- Create: `web/src/state.ts`

**Interfaces:**
- Consumes: `api` from `web/src/api.ts` (Task 3); `StateResponse` from `web/src/types.ts` (Task 3).
- Produces: `useAppState()` hook returning:
  ```ts
  {
    state: StateResponse | null;
    error: string | null;
    reload: () => Promise<void>;
  }
  ```
  Later tasks read `state.tickets`, `state.runs`, `state.jobs`, `state.metrics`, `state.config` and call `reload()` after mutating actions (start run, approve, reject, save review, reorder).

- [ ] **Step 1: Create `web/src/state.ts`**

Ports `load()` and `listen()` from the old `web/index.html` into a hook. The SSE `EventSource` opens once per mount and is closed on unmount (the old code never closed it, since the page never unmounted — React's `useEffect` cleanup makes this explicit and correct).

```ts
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { StateResponse } from "./types";

export function useAppState() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api<StateResponse>("/api/state");
      setState(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();

    const source = new EventSource("/api/events");
    const refresh = () => void reload();
    source.addEventListener("job", refresh);
    source.addEventListener("run", refresh);
    // EventSource reconnects on its own; no error handling needed here.

    return () => source.close();
  }, [reload]);

  return { state, error, reload };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd web && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/state.ts
git commit -m "Add useAppState hook for state loading and SSE refresh"
```

---

### Task 5: App shell, Nav, and tab routing

**Files:**
- Create: `web/src/components/Nav.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `useAppState` (Task 4), `StateResponse` (Task 3).
- Produces: `type TabId = "board" | "queue" | "review" | "metrics" | "settings"`, exported from `App.tsx`, used by `Nav.tsx` and later view components. `Nav` props: `{ active: TabId; onChange: (tab: TabId) => void; reviewCount: number }`.

- [ ] **Step 1: Move CSS out of the old `<style>` block into `web/src/styles.css`**

Copy the full `<style>...</style>` contents from the old `web/index.html:7-103` verbatim into `web/src/styles.css` (selectors unchanged — `.wrap`, `.cols`, `.card`, `.kpi`, etc. all still apply since component markup will reuse the same class names).

- [ ] **Step 2: Create `web/src/components/Nav.tsx`**

Ports the tab bar from old `render()` (`web/index.html:178-182`). Tab labels translated to English (`Papan`→`Board`, `Antrean`→`Queue`, `Review`→`Review`, `Metrik`→`Metrics`, `Setelan`→`Settings`).

```tsx
export type TabId = "board" | "queue" | "review" | "metrics" | "settings";

const TABS: Array<[TabId, string]> = [
  ["board", "Board"],
  ["queue", "Queue"],
  ["review", "Review"],
  ["metrics", "Metrics"],
  ["settings", "Settings"],
];

interface NavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  reviewCount: number;
}

export default function Nav({ active, onChange, reviewCount }: NavProps) {
  return (
    <nav>
      {TABS.map(([id, label]) => (
        <button key={id} className={active === id ? "on" : ""} onClick={() => onChange(id)}>
          {label}
          {id === "review" && reviewCount > 0 ? <span className="pill">{reviewCount}</span> : null}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Rewrite `web/src/App.tsx`**

Replaces `render()`/`go()`/`openRun` global handling (`web/index.html:132-190`) with component state. View components (`Board`, `Queue`, `Review`, `Metrics`, `Settings`, `RunDetail`) are added in Tasks 6–11 — reference them here as placeholders that Task 6+ will replace one by one; for this task, stub the four not-yet-built views inline so the app compiles and the header/nav/repo-label wiring can be verified now.

```tsx
import { useState } from "react";
import Nav, { type TabId } from "./components/Nav";
import { useAppState } from "./state";

interface OpenRun {
  ticket: string;
  runId: string;
}

export default function App() {
  const { state, error, reload } = useAppState();
  const [tab, setTab] = useState<TabId>("board");
  const [openRun, setOpenRun] = useState<OpenRun | null>(null);

  if (error) {
    return (
      <div className="wrap">
        <div className="empty">
          Could not reach the server: {error}
          <br />
          Run <code>node dist/cli.js serve</code> first.
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="wrap">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const reviewCount = state.runs.filter(
    (r) => r.outcome === "awaiting_plan_approval" || (r.outcome === "ready_for_review" && r.humanEditedLines === null),
  ).length;

  const repoLabel = `${state.config.repoPath.split("/").slice(-1)[0]} · ${state.config.baseBranch}`;

  const goTab = (next: TabId) => {
    setTab(next);
    setOpenRun(null);
  };

  return (
    <div className="wrap">
      <header>
        <span className="brand">Agent pipeline</span>
        <span className="repo">{repoLabel}</span>
        <Nav active={tab} onChange={goTab} reviewCount={reviewCount} />
      </header>
      <div id="main">
        {openRun ? (
          <div className="empty">Run detail placeholder — added in Task 11.</div>
        ) : (
          <div className="empty">Tab "{tab}" placeholder — added in Tasks 6–10.</div>
        )}
      </div>
    </div>
  );
}
```

Note: `state`, `reload`, `openRun`, `setOpenRun` are unused by the placeholder branches above and will show as TS/lint "unused variable" only if `noUnusedLocals` were set (it isn't, per this project's `tsconfig.json` pattern) — but Tasks 6–11 consume them immediately after, so this is transitional by design, not a loose end.

- [ ] **Step 4: Verify in browser**

Run: `cd web && npm run dev` (with backend running via `node dist/cli.js serve` in another terminal for the `/api/state` proxy to succeed).
Expected: header shows "Agent pipeline", repo label, and 5 nav buttons; clicking each shows the corresponding placeholder text; "Review" shows a pill count if any runs are awaiting approval.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/components/Nav.tsx web/src/styles.css
git commit -m "Add App shell, Nav, and tab routing"
```

---

### Task 6: Board view

**Files:**
- Create: `web/src/components/Board.tsx`
- Create: `web/src/outcomeLabels.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `StateResponse`, `RunRecord`, `Job`, `TicketInput` (Task 3); `api` (Task 3); `reload` from `useAppState` (Task 4).
- Produces: `OUTCOME_LABEL: Record<Outcome, string>` exported from `web/src/outcomeLabels.ts` (reused by Queue, Review, Metrics, RunDetail in later tasks). `Board` props: `{ state: StateResponse; onOpenRun: (ticket: string, runId: string) => void; reload: () => Promise<void> }`.

- [ ] **Step 1: Create `web/src/outcomeLabels.ts`**

Ports the `OUTCOME` map from old `web/index.html:124-130`, English labels, keyed by the `Outcome` type so TypeScript enforces completeness (mirrors how `src/dashboard.ts`'s `OUTCOME_LABEL: Record<Outcome, string>` forces the backend to stay exhaustive — see CLAUDE.md's note on this pattern).

```ts
import type { Outcome } from "./types";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  plan_failed: "plan failed",
  plan_timeout: "plan timed out",
  plan_out_of_scope: "out of scope",
  awaiting_plan_approval: "awaiting approval",
  plan_rejected: "plan rejected",
  implementing: "implementing",
  no_changes: "no changes",
  guardrail_blocked: "guardrail blocked",
  tests_failed: "tests failed",
  ready_for_review: "ready for review",
  error: "error",
};
```

- [ ] **Step 2: Create `web/src/components/Board.tsx`**

Ports `renderBoard`, `cardHtml`, `startOne`, `toolbar` (the board-only part) from `web/index.html:193-262`.

```tsx
import { api } from "../api";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunRecord, StateResponse, TicketInput } from "../types";

interface BoardProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
  reload: () => Promise<void>;
}

interface BoardItem {
  ticket: TicketInput;
  run: RunRecord | undefined;
  job: Job | undefined;
}

function activeJob(jobs: Job[], ticket: string): Job | undefined {
  return jobs.find((j) => j.ticket === ticket && (j.state === "running" || j.state === "queued"));
}

function latestByTicket(runs: RunRecord[]): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>();
  for (const r of runs) map.set(r.ticket, r);
  return map;
}

export default function Board({ state, onOpenRun, reload }: BoardProps) {
  const latest = latestByTicket(state.runs);
  const columns: Array<[string, BoardItem[]]> = [
    ["Queue", []],
    ["Waiting on you", []],
    ["Running", []],
    ["Ready for review", []],
    ["Done / stopped", []],
  ];

  for (const ticket of state.tickets) {
    const job = activeJob(state.jobs, ticket.key);
    const run = latest.get(ticket.key);
    const item: BoardItem = { ticket, run, job };
    if (job) {
      columns[2]![1].push(item);
      continue;
    }
    if (run && run.outcome === "awaiting_plan_approval") {
      columns[1]![1].push(item);
      continue;
    }
    if (run && run.outcome === "ready_for_review" && run.merged === null) {
      columns[3]![1].push(item);
      continue;
    }
    if (run && run.outcome !== "no_changes") {
      columns[4]![1].push(item);
      continue;
    }
    columns[0]![1].push(item);
  }

  const runsWithoutTicket = state.runs.filter((r) => !state.tickets.some((t) => t.key === r.ticket));
  for (const run of runsWithoutTicket) {
    columns[4]![1].push({ ticket: { key: run.ticket, summary: "(no longer queued)", description: "" }, run, job: undefined });
  }

  const running = state.jobs.filter((j) => j.state === "running").length;
  const queued = state.jobs.filter((j) => j.state === "queued").length;

  const startOne = async (key: string) => {
    try {
      await api("/api/runs", "POST", { ticket: key });
    } catch (e) {
      alert((e as Error).message);
    }
    await reload();
  };

  return (
    <>
      <div className="bar">
        <span className="hint">
          Pick which tickets to run from the <b>Queue</b> tab — there's deliberately no "run all" button here.
        </span>
        <span className="status">
          {running} running · {queued} queued · runs serially
        </span>
      </div>
      <div className="cols">
        {columns.map(([name, items]) => (
          <div className="col" key={name}>
            <h3>
              {name} · {items.length}
            </h3>
            {items.length === 0 ? (
              <div className="hint">empty</div>
            ) : (
              items.map((item) => <Card key={item.ticket.key} item={item} onOpenRun={onOpenRun} onStart={startOne} />)
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Card({
  item,
  onOpenRun,
  onStart,
}: {
  item: BoardItem;
  onOpenRun: (ticket: string, runId: string) => void;
  onStart: (key: string) => void;
}) {
  const { ticket, run, job } = item;
  const cls = job
    ? ""
    : run && run.outcome === "awaiting_plan_approval"
      ? "w"
      : run && (run.outcome === "guardrail_blocked" || run.outcome === "tests_failed" || run.outcome === "error")
        ? "b"
        : "";

  const handleClick = () => {
    if (run) onOpenRun(ticket.key, run.runId);
    else onStart(ticket.key);
  };

  return (
    <div className={`card ${cls}`} onClick={handleClick}>
      <div className="key">{ticket.key}</div>
      <div className="ttl">{(ticket.summary || "").slice(0, 78)}</div>
      {job ? (
        <>
          <div className="meta">
            {job.step}
            {job.detail ? ` · ${job.detail}` : ""}
          </div>
          <div className="prog">
            <i></i>
          </div>
        </>
      ) : run ? (
        <>
          <span className={`tag ${run.lane === 3 ? "r" : run.lane === 1 ? "g" : ""}`}>
            {run.lane ? `Lane ${run.lane}` : null}
          </span>
          <span className={`tag ${run.outcome === "ready_for_review" ? "g" : run.outcome === "awaiting_plan_approval" ? "w" : ""}`}>
            {OUTCOME_LABEL[run.outcome]}
          </span>
          {run.filesChanged ? (
            <div className="meta">
              {run.filesChanged} files · {run.diffLines} lines
              {run.addedTestFiles ? ` · ${run.addedTestFiles} new specs` : ""}
            </div>
          ) : null}
          {run.blockedBy.length > 0 ? <div className="meta" style={{ color: "var(--bad-tx)" }}>{run.blockedBy[0]}</div> : null}
        </>
      ) : (
        <div className="hint">click to start</div>
      )}
    </div>
  );
}
```

Note on the `lane` tag: the old code always rendered a `<span class="tag">` for lane (`web/index.html:242`) only `if (run.lane)`; the port above renders the `<span>` unconditionally but leaves it empty when `run.lane` is falsy to keep JSX simpler — visually identical since an empty `<span>` with no text takes no visible space, but if this reads as a regression during Step 3's manual check, gate it with `{run.lane ? (...) : null}` instead.

- [ ] **Step 3: Wire `Board` into `App.tsx`**

In `web/src/App.tsx`, replace the `tab === "board"` placeholder branch. Add import `import Board from "./components/Board";` and, inside the `<div id="main">`, replace:

```tsx
<div className="empty">Tab "{tab}" placeholder — added in Tasks 6–10.</div>
```

with a per-tab conditional that (for now) still falls back to the placeholder for the other four tabs:

```tsx
{tab === "board" && <Board state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
{tab !== "board" && <div className="empty">Tab "{tab}" placeholder — added in Tasks 7–10.</div>}
```

- [ ] **Step 4: Verify in browser**

With backend running and `npm run dev` in `web/`, open the Board tab.
Expected: five columns matching the old UI's grouping (Queue/Waiting on you/Running/Ready for review/Done), cards clickable, "click to start" cards trigger a run via `POST /api/runs`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Board.tsx web/src/outcomeLabels.ts web/src/App.tsx
git commit -m "Add Board view component"
```

---

### Task 7: Queue view (selection + drag-drop reorder)

**Files:**
- Create: `web/src/components/Queue.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `OUTCOME_LABEL` (Task 6), `StateResponse`/`TicketInput`/`Job` (Task 3), `api` (Task 3).
- Produces: `Queue` props: `{ state: StateResponse; onOpenRun: (ticket: string, runId: string) => void; reload: () => Promise<void> }`. Selection state (`sel: Set<string>`) is now **local to `Queue`**, not lifted to `App` — nothing outside Queue needs it (the old code kept `sel` global only because everything was global).

- [ ] **Step 1: Create `web/src/components/Queue.tsx`**

Ports `renderQueue`, `toggleSel`, `toggleSelAll`, `freshTickets`, `startSelected`, and the drag-drop handlers from `web/index.html:267-360`. Native HTML5 drag events are used directly on `<tr>` via React's `onDragStart`/`onDragOver`/`onDrop` props — no manual `querySelectorAll` rewiring needed, since React re-renders the list and reattaches handlers itself.

```tsx
import { useState } from "react";
import { api } from "../api";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunRecord, StateResponse, TicketInput } from "../types";

interface QueueProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
  reload: () => Promise<void>;
}

function activeJob(jobs: Job[], ticket: string): Job | undefined {
  return jobs.find((j) => j.ticket === ticket && (j.state === "running" || j.state === "queued"));
}

function latestByTicket(runs: RunRecord[]): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>();
  for (const r of runs) map.set(r.ticket, r);
  return map;
}

function freshTickets(state: StateResponse): TicketInput[] {
  const latest = latestByTicket(state.runs);
  return state.tickets.filter((t) => {
    if (activeJob(state.jobs, t.key)) return false;
    const r = latest.get(t.key);
    return !r || r.outcome === "no_changes";
  });
}

export default function Queue({ state, onOpenRun, reload }: QueueProps) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const latest = latestByTicket(state.runs);
  const fresh = freshTickets(state).map((t) => t.key);
  const allOn = fresh.length > 0 && fresh.every((k) => sel.has(k));
  const chosen = state.tickets.filter((t) => sel.has(t.key)).length;

  const toggleSel = (key: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelAll = () => {
    setSel((prev) => {
      if (allOn) {
        const next = new Set(prev);
        fresh.forEach((k) => next.delete(k));
        return next;
      }
      return new Set([...prev, ...fresh]);
    });
  };

  const startOne = async (key: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/runs", "POST", { ticket: key });
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
    await reload();
  };

  const startSelected = async () => {
    const keys = state.tickets.map((t) => t.key).filter((k) => sel.has(k));
    if (keys.length === 0) return;
    if (!confirm(`Run the plan stage for ${keys.length} ticket(s)?\n\n${keys.join("\n")}`)) return;

    setBusy(true);
    for (const key of keys) {
      try {
        await api("/api/runs", "POST", { ticket: key });
      } catch (e) {
        alert(`${key}: ${(e as Error).message}`);
        break;
      }
    }
    setSel(new Set());
    setBusy(false);
    await reload();
  };

  const handleDrop = async (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    const order = state.tickets.map((t) => t.key).filter((k) => k !== dragKey);
    const targetIndex = order.indexOf(targetKey);
    order.splice(targetIndex, 0, dragKey);
    await api("/api/queue/reorder", "POST", { order });
    await reload();
  };

  return (
    <>
      <div className="bar">
        <button className="act warn" onClick={() => void startSelected()} disabled={chosen === 0 || busy}>
          Run {chosen || ""} selected
        </button>
        <button className="act" onClick={toggleSelAll}>
          {allOn ? "Clear selection" : "Select unused tickets"}
        </button>
        <span className="status">
          {state.jobs.filter((j) => j.state === "running").length} running · {state.jobs.filter((j) => j.state === "queued").length} queued · runs serially
        </span>
      </div>
      <div className="hint" style={{ marginBottom: 10 }}>
        Check the tickets you want to run — each attempt spends model quota, so pick only what's needed. Row order = execution
        order; drag rows to change priority.
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th style={{ width: 26 }}></th>
            <th>Ticket</th>
            <th>Title</th>
            <th>Last status</th>
            <th className="n">Files</th>
            <th className="n">Lines</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.tickets.map((t, i) => {
            const r = latest.get(t.key);
            const j = activeJob(state.jobs, t.key);
            const used = !!r && r.outcome !== "no_changes";
            const on = sel.has(t.key);
            return (
              <tr
                key={t.key}
                className={`row ${on ? "on" : ""}`}
                draggable
                onDragStart={() => setDragKey(t.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(t.key);
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!!j}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSel(t.key)}
                  />
                </td>
                <td style={{ color: "var(--tx3)", fontSize: 11 }}>{i + 1}</td>
                <td className="key">
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.key}
                    </a>
                  ) : (
                    t.key
                  )}
                </td>
                <td style={{ fontSize: 12 }}>{(t.summary || "").slice(0, 78)}</td>
                <td style={{ fontSize: 12 }}>{j ? j.step : used ? OUTCOME_LABEL[r!.outcome] : "never run"}</td>
                <td className="n">{r ? r.filesChanged : "—"}</td>
                <td className="n">{r ? r.diffLines : "—"}</td>
                <td>
                  {r ? (
                    <button className="act" onClick={() => onOpenRun(t.key, r.runId)}>
                      Open
                    </button>
                  ) : (
                    <button className="act" onClick={() => void startOne(t.key)}>
                      Start
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hint" style={{ marginTop: 10 }}>
        {fresh.length} of {state.tickets.length} tickets have never been run. "Select unused tickets" won't select tickets that
        already have a result.
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire `Queue` into `App.tsx`**

Add `import Queue from "./components/Queue";` and extend the per-tab conditional from Task 6:

```tsx
{tab === "board" && <Board state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
{tab === "queue" && <Queue state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
{tab !== "board" && tab !== "queue" && <div className="empty">Tab "{tab}" placeholder — added in Tasks 8–10.</div>}
```

- [ ] **Step 3: Verify in browser**

Open the Queue tab: check a couple of tickets, confirm the "Run N selected" button enables/disables correctly, confirm drag-to-reorder persists (reload the page — order should stick, since it's written to `queue.json` server-side).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Queue.tsx web/src/App.tsx
git commit -m "Add Queue view component with drag-drop reorder"
```

---

### Task 8: Review view

**Files:**
- Create: `web/src/components/Review.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `OUTCOME_LABEL` (Task 6), `StateResponse`/`RunRecord` (Task 3).
- Produces: `Review` props: `{ state: StateResponse; onOpenRun: (ticket: string, runId: string) => void }`. Exports `reviewItems(runs: RunRecord[]): RunRecord[]` — reused by `Nav`'s badge count logic if `App.tsx` is later refactored to import it instead of duplicating the filter (see note in Step 2).

- [ ] **Step 1: Create `web/src/components/Review.tsx`**

Ports `reviewItems` and `renderReview` from `web/index.html:363-384`.

```tsx
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { RunRecord, StateResponse } from "../types";

export function reviewItems(runs: RunRecord[]): RunRecord[] {
  return runs.filter(
    (r) => r.outcome === "awaiting_plan_approval" || (r.outcome === "ready_for_review" && r.humanEditedLines === null),
  );
}

interface ReviewProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
}

export default function Review({ state, onOpenRun }: ReviewProps) {
  const items = reviewItems(state.runs);

  if (items.length === 0) {
    return <div className="empty">Nothing waiting on you.</div>;
  }

  return (
    <>
      <div className="hint" style={{ marginBottom: 10 }}>
        Without filling in the review result, autonomy rate can't be computed — and that's the pilot's headline metric.
      </div>
      {items.map((r) => (
        <div className="panel" key={r.runId}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="key">{r.ticket}</span>
            <span className={`tag ${r.outcome === "awaiting_plan_approval" ? "w" : "g"}`}>{OUTCOME_LABEL[r.outcome]}</span>
            {r.lane ? <span className={`tag ${r.lane === 3 ? "r" : ""}`}>Lane {r.lane}</span> : null}
            <button className="act" style={{ marginLeft: "auto" }} onClick={() => onOpenRun(r.ticket, r.runId)}>
              {r.outcome === "awaiting_plan_approval" ? "Read plan" : "Fill in review"}
            </button>
          </div>
          {r.notes ? <div className="hint">{r.notes}</div> : null}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Wire `Review` into `App.tsx` and reuse `reviewItems` for the nav badge**

Add `import Review, { reviewItems } from "./components/Review";`, replace the inline `reviewCount` computation (added in Task 5) with `reviewItems(state.runs).length`, and extend the tab conditional:

```tsx
const reviewCount = reviewItems(state.runs).length;
```

```tsx
{tab === "review" && <Review state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} />}
{tab !== "board" && tab !== "queue" && tab !== "review" && (
  <div className="empty">Tab "{tab}" placeholder — added in Tasks 9–10.</div>
)}
```

- [ ] **Step 3: Verify in browser**

Open the Review tab: confirm it lists exactly the runs awaiting approval or unreviewed-ready-for-review, matching the nav pill count.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Review.tsx web/src/App.tsx
git commit -m "Add Review view component"
```

---

### Task 9: Metrics view

**Files:**
- Create: `web/src/components/Metrics.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `Metrics` type (Task 3).
- Produces: `Metrics` component, props: `{ metrics: MetricsType }` (aliasing the imported type to avoid a name clash with the component itself).

- [ ] **Step 1: Create `web/src/components/Metrics.tsx`**

Ports `renderMetrics`, `pct`, `mins` from `web/index.html:144-145,387-403`.

```tsx
import type { Metrics as MetricsType } from "../types";

function pct(v: number | null): string {
  return v === null || v === undefined ? "—" : `${String(Math.round(v * 100))}%`;
}

function mins(s: number | null): string {
  return s === null || s === undefined ? "—" : `${(s / 60).toFixed(1)} min`;
}

interface MetricsProps {
  metrics: MetricsType;
}

export default function Metrics({ metrics: m }: MetricsProps) {
  return (
    <>
      <div className="cards">
        <div className="kpi">
          <div className="k">Attempts</div>
          <div className="v">{m.total}</div>
        </div>
        <div className="kpi">
          <div className="k">Ready for review</div>
          <div className="v">{m.readyForReview}</div>
        </div>
        <div className="kpi">
          <div className="k">Attempt success</div>
          <div className="v">{pct(m.attemptSuccessRate)}</div>
          <div className="h">Week 3 target: 60%</div>
        </div>
        <div className="kpi">
          <div className="k">Autonomy rate</div>
          <div className="v">{pct(m.autonomyRate)}</div>
          <div className="h">of {m.autonomyDenominator} merged PRs · target 40%</div>
        </div>
        <div className="kpi">
          <div className="k">Median duration</div>
          <div className="v">{mins(m.medianDurationSec)}</div>
        </div>
      </div>
      <div className="two">
        <div className="panel">
          <h4>Outcomes</h4>
          <table>
            <tbody>
              {m.byOutcome.length > 0 ? (
                m.byOutcome.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="n">{v}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>none yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Gate lanes</h4>
          <table>
            <tbody>
              {m.byLane.length > 0 ? (
                m.byLane.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="n">{v}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>none yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="hint">
        Autonomy rate = percent of merged PRs that no human touched at all. What matters is the trend rising week over week,
        not the absolute number — with a dozen-odd attempts, one number doesn't mean much yet.
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire `Metrics` into `App.tsx`**

Add `import MetricsView from "./components/Metrics";` (aliased on import to avoid clashing with the `Metrics` type name already imported from `./types` elsewhere in the file if present) and extend the tab conditional:

```tsx
{tab === "metrics" && <MetricsView metrics={state.metrics} />}
{tab !== "board" && tab !== "queue" && tab !== "review" && tab !== "metrics" && (
  <div className="empty">Tab "{tab}" placeholder — added in Task 10.</div>
)}
```

- [ ] **Step 3: Verify in browser**

Open the Metrics tab: confirm the five KPI cards and two tables render (values will mostly be "—"/0/empty on a fresh install with no runs yet — that's expected, not a bug).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Metrics.tsx web/src/App.tsx
git commit -m "Add Metrics view component"
```

---

### Task 10: Settings view

**Files:**
- Create: `web/src/components/Settings.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `ConfigResponse` (Task 3), `api` (Task 3).
- Produces: `Settings` component, no props (fetches its own config on mount, matching the old lazy-load-on-first-visit behavior).

- [ ] **Step 1: Create `web/src/components/Settings.tsx`**

Ports `renderSettings` from `web/index.html:406-429`. The old code cached `cfg` in a module-level variable so it only fetched once across tab switches; here, `useState`+`useEffect` with an empty dependency array gives the same one-fetch-per-mount behavior, and since `Settings` only mounts when its tab is selected (not eagerly), switching away and back re-fetches — a minor, acceptable behavior change (config rarely changes at runtime) rather than adding cross-tab caching machinery for a settings panel.

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import type { ConfigResponse } from "../types";

export default function Settings() {
  const [cfg, setCfg] = useState<ConfigResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<ConfigResponse>("/api/config")
      .then(setCfg)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="empty">Failed to load settings.</div>;
  if (!cfg) return <div className="empty">Loading…</div>;

  const { limits: L, laneRules: R } = cfg;

  return (
    <>
      <div className="two">
        <div className="panel">
          <h4>Safety limits</h4>
          <table>
            <tbody>
              <tr>
                <td>Files changed</td>
                <td className="n">{L.maxFilesChanged}</td>
              </tr>
              <tr>
                <td>Diff lines</td>
                <td className="n">{L.maxDiffLines}</td>
              </tr>
              <tr>
                <td>Plan timeout</td>
                <td className="n">{L.planTimeoutMs / 60000} min</td>
              </tr>
              <tr>
                <td>Implement timeout</td>
                <td className="n">{L.implementTimeoutMs / 60000} min</td>
              </tr>
              <tr>
                <td>rspec timeout</td>
                <td className="n">{L.rspecTimeoutMs / 60000} min</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Lane rules</h4>
          <table>
            <tbody>
              <tr>
                <td>Lane 1 (no review)</td>
                <td className="n">{R.lane1Enabled ? "ON" : "off"}</td>
              </tr>
              <tr>
                <td>Lane 1 diff limit</td>
                <td className="n">{R.lane1MaxDiffLines}</td>
              </tr>
              <tr>
                <td>Requires new specs</td>
                <td className="n">{R.lane1RequiresNewTests ? "yes" : "no"}</td>
              </tr>
            </tbody>
          </table>
          <div className="hint">
            Lane 1 is deliberately off during the pilot. The asymmetry: auto-merge saves a few hours, one bug slipping through
            in the GL domain can end the pilot.
          </div>
        </div>
      </div>
      <div className="panel">
        <h4>Blocklist · {cfg.blocklist.length} paths</h4>
        <table>
          <tbody>
            {cfg.blocklist.map((b) => (
              <tr key={b.pattern}>
                <td className="key">{b.pattern}</td>
                <td style={{ fontSize: 11, color: "var(--tx2)" }}>{b.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire `Settings` into `App.tsx`, removing the placeholder fallback**

Add `import Settings from "./components/Settings";`. This is the last of the five tabs, so replace the whole placeholder conditional chain with a single `switch`-like set of five conditions and delete the fallback `<div className="empty">Tab "{tab}" placeholder...</div>` entirely:

```tsx
{tab === "board" && <Board state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
{tab === "queue" && <Queue state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
{tab === "review" && <Review state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} />}
{tab === "metrics" && <MetricsView metrics={state.metrics} />}
{tab === "settings" && <Settings />}
```

- [ ] **Step 3: Verify in browser**

Open the Settings tab: confirm safety limits, lane rules, and the full blocklist table render correctly.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Settings.tsx web/src/App.tsx
git commit -m "Add Settings view component"
```

---

### Task 11: Run detail view (plan, diff, rspec, review form)

**Files:**
- Create: `web/src/components/Diff.tsx`
- Create: `web/src/components/RunDetail.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `RunDetailResponse`, `RunRecord` (Task 3); `OUTCOME_LABEL` (Task 6); `api` (Task 3).
- Produces: `Diff` component, props `{ patch: string }`. `RunDetail` component, props `{ ticket: string; runId: string; onBack: () => void; onChanged: () => Promise<void> }` (`onChanged` triggers the outer `reload` after approve/reject/save-review, matching the old code's `await load()` after every mutating action).

- [ ] **Step 1: Create `web/src/components/Diff.tsx`**

Ports `diffHtml` from `web/index.html:492-499`.

```tsx
interface DiffProps {
  patch: string;
}

export default function Diff({ patch }: DiffProps) {
  const lines = patch.split("\n").slice(0, 600);
  return (
    <div className="diff">
      {lines.map((line, i) => {
        const cls = line.startsWith("+") && !line.startsWith("+++")
          ? "a"
          : line.startsWith("-") && !line.startsWith("---")
            ? "d"
            : line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")
              ? "h"
              : "";
        return (
          <div className={cls} key={i}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/components/RunDetail.tsx`**

Ports `openDetail`, `renderDetail`, `reviewForm`, `approve`, `reject`, `saveReview` from `web/index.html:432-552`.

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import Diff from "./Diff";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { RunDetailResponse } from "../types";

interface RunDetailProps {
  ticket: string;
  runId: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}

export default function RunDetail({ ticket, runId, onBack, onChanged }: RunDetailProps) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<RunDetailResponse>(`/api/runs/${ticket}/${runId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, [ticket, runId]);

  if (error) {
    return (
      <>
        <span className="back" onClick={onBack}>
          ← back
        </span>
        <div className="empty">{error}</div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <span className="back" onClick={onBack}>
          ← back
        </span>
        <div className="empty">Loading…</div>
      </>
    );
  }

  const r = data.record;
  const awaiting = r.outcome === "awaiting_plan_approval";
  const reviewable = r.outcome === "ready_for_review";

  const approve = async () => {
    try {
      await api(`/api/runs/${ticket}/${runId}/approve`, "POST", {});
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onBack();
    await onChanged();
  };

  const reject = async () => {
    const reason = prompt("Why reject this plan?") ?? "";
    try {
      await api(`/api/runs/${ticket}/${runId}/reject`, "POST", { reason });
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onBack();
    await onChanged();
  };

  return (
    <>
      <span className="back" onClick={onBack}>
        ← back
      </span>
      <div className="panel">
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="key">
            {r.ticketUrl ? (
              <a href={r.ticketUrl} target="_blank" rel="noreferrer">
                {r.ticket}
              </a>
            ) : (
              r.ticket
            )}
          </span>
          <span className={`tag ${reviewable ? "g" : awaiting ? "w" : ""}`}>{OUTCOME_LABEL[r.outcome]}</span>
          {r.lane ? <span className={`tag ${r.lane === 3 ? "r" : r.lane === 1 ? "g" : ""}`}>Lane {r.lane}</span> : null}
          <span className="meta">
            {r.filesChanged} files · {r.diffLines} lines · {r.addedTestFiles} new specs ·{" "}
            {r.durationSec ? `${(r.durationSec / 60).toFixed(1)} min` : "—"}
          </span>
        </div>
        <div className="meta">branch {r.branch}</div>
        {r.notes ? <div className="hint">{r.notes}</div> : null}
        {r.blockedBy.length > 0 ? (
          <div className="hint" style={{ color: "var(--bad-tx)" }}>
            Blocked: {r.blockedBy.join("; ")}
          </div>
        ) : null}
        {r.violations.length > 0 ? (
          <div className="hint" style={{ color: "var(--bad-tx)" }}>
            Violations: {r.violations.join("; ")}
          </div>
        ) : null}
        {awaiting ? (
          <div className="bar">
            <button className="act warn" onClick={() => void approve()}>
              Approve plan → start coding
            </button>
            <button className="act bad" onClick={() => void reject()}>
              Reject plan
            </button>
          </div>
        ) : null}
      </div>

      <div className="two">
        <div className="panel">
          <h4>Plan</h4>
          {data.plan ? <pre>{data.plan}</pre> : <div className="hint">none yet</div>}
        </div>
        <div className="panel">
          <h4>Diff</h4>
          {data.diff ? <Diff patch={data.diff} /> : <div className="hint">no changes yet</div>}
        </div>
      </div>

      {r.rspec && r.rspec.ran ? (
        <div className="panel">
          <h4>rspec result</h4>
          <table>
            <tbody>
              <tr>
                <td>Examples run</td>
                <td className="n">{r.rspec.exampleCount ?? "?"}</td>
              </tr>
              <tr>
                <td>Failures</td>
                <td className="n">{r.rspec.failureCount ?? "?"}</td>
              </tr>
              <tr>
                <td>Duration</td>
                <td className="n">{r.rspec.durationSec ? `${r.rspec.durationSec.toFixed(1)} s` : "—"}</td>
              </tr>
              <tr>
                <td>Specs run</td>
                <td style={{ font: "11px var(--mono)" }}>{r.rspec.targets.join(", ") || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {data.toolCalls ? (
        <div className="panel">
          <h4>Tool calls used by the agent</h4>
          <pre>{data.toolCalls}</pre>
        </div>
      ) : null}
      {data.agentOutput ? (
        <div className="panel">
          <h4>Agent notes</h4>
          <pre>{data.agentOutput.slice(-3000)}</pre>
        </div>
      ) : null}

      {reviewable || r.humanEditedLines !== null ? <ReviewForm ticket={ticket} runId={runId} record={r} onSaved={load} /> : null}
    </>
  );
}

function ReviewForm({
  ticket,
  runId,
  record,
  onSaved,
}: {
  ticket: string;
  runId: string;
  record: RunDetailResponse["record"];
  onSaved: () => void;
}) {
  const [hel, setHel] = useState(record.humanEditedLines?.toString() ?? "");
  const [rr, setRr] = useState(record.reviewRounds?.toString() ?? "");
  const [merged, setMerged] = useState(record.merged === true ? "yes" : record.merged === false ? "no" : "");
  const [notes, setNotes] = useState(record.notes ?? "");

  const save = async () => {
    try {
      await api(`/api/runs/${ticket}/${runId}/review`, "POST", {
        humanEditedLines: hel === "" ? null : Number(hel),
        reviewRounds: rr === "" ? null : Number(rr),
        merged: merged === "" ? null : merged === "yes",
        notes,
      });
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onSaved();
  };

  return (
    <div className="panel">
      <h4>Review result — only fillable by a human</h4>
      <div className="grid3">
        <div>
          <label>Lines of code you changed after the PR was opened</label>
          <input type="number" min={0} value={hel} placeholder="0" onChange={(e) => setHel(e.target.value)} />
        </div>
        <div>
          <label>Review rounds</label>
          <input type="number" min={0} value={rr} placeholder="1" onChange={(e) => setRr(e.target.value)} />
        </div>
        <div>
          <label>Merged?</label>
          <select value={merged} onChange={(e) => setMerged(e.target.value)}>
            <option value="">not yet</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label>Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="bar">
        <button className="act" onClick={() => void save()}>
          Save review
        </button>
      </div>
      <div className="hint">
        Zero in the first column means the agent's work was truly taken as-is — that's what counts toward autonomy rate.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire `RunDetail` into `App.tsx`, replacing the detail placeholder from Task 5**

Add `import RunDetail from "./components/RunDetail";`. Replace:

```tsx
{openRun ? (
  <div className="empty">Run detail placeholder — added in Task 11.</div>
) : (
  ...
)}
```

with:

```tsx
{openRun ? (
  <RunDetail ticket={openRun.ticket} runId={openRun.runId} onBack={() => setOpenRun(null)} onChanged={reload} />
) : (
  <>
    {tab === "board" && <Board state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
    {tab === "queue" && <Queue state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
    {tab === "review" && <Review state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} />}
    {tab === "metrics" && <MetricsView metrics={state.metrics} />}
    {tab === "settings" && <Settings />}
  </>
)}
```

- [ ] **Step 4: Verify in browser**

Click into a run from Board, Queue, or Review. Confirm plan/diff/rspec panels render, approve/reject work for an awaiting-approval run, and saving the review form persists (reopen the run — values should stick).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Diff.tsx web/src/components/RunDetail.tsx web/src/App.tsx
git commit -m "Add RunDetail view with plan, diff, rspec, and review form"
```

---

### Task 12: Remove the old frontend, full manual verification pass

**Files:**
- Delete: `web/index.html` (old vanilla version — the new Vite entry created in Task 1 has already replaced it at the same path; verify no old content survives)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the complete app built across Tasks 1–11.
- Produces: none (this is the verification and documentation-closing task).

- [ ] **Step 1: Confirm `web/index.html` is the Vite entry, not the old file**

Run: `git log --oneline -- web/index.html`
Expected: shows the Task 1 commit ("Scaffold Vite + React + TypeScript project in web/") replacing whatever the file was before this plan started. If the old 569-line vanilla content is still present (it shouldn't be, since Task 1 Step 5 wrote a fresh Vite entry to this same path), replace it now with the Task 1 Step 5 content.

- [ ] **Step 2: Full build and serve**

Run: `npm run build && node dist/cli.js serve`
Expected: no build errors; server starts; `http://127.0.0.1:4319/` loads the real app (not a placeholder).

- [ ] **Step 3: Manual verification checklist in the browser**

Go through each item and confirm it matches pre-migration behavior:
- Board: all 5 columns populate correctly; clicking an unstarted ticket's card starts a plan run; clicking a ticket with a run opens its detail.
- Queue: checkbox selection, "Select unused tickets" toggle, "Run N selected" confirm dialog, drag-and-drop reorder (persists after reload).
- Review: lists exactly runs awaiting approval or unreviewed ready-for-review runs; nav pill count matches.
- Metrics: five KPI cards and two breakdown tables render without runtime errors, including the empty-state ("none yet") when there's no data.
- Settings: safety limits, lane rules, and full blocklist table render.
- Run detail: plan/diff/rspec sections render for a completed run; approve/reject work for an awaiting-approval run; review form saves and persists on reopen.
- SSE: start a run and confirm the Board/Queue update live without a manual page refresh (job step/progress bar shows while running).

- [ ] **Step 4: Update `CLAUDE.md` status table and structure table**

In the "Status sekarang" table, change the row:

```
| UI 5 layar (`web/index.html`) | jalan; **belum pernah diverifikasi tampilannya di browser** |
```

to:

```
| UI 5 layar (React + Vite, `web/src/`) | jalan; diverifikasi manual di browser 5 tab + detail run |
```

In the "Struktur" table, add a row after the `web/index.html` row (which itself should now read `web/` since the old single-file description no longer applies):

```
| `web/` | Frontend React + TypeScript + Vite. `npm install` & `npm run build` terpisah dari root |
```

- [ ] **Step 5: Commit**

```bash
git add web/index.html CLAUDE.md
git commit -m "Complete React UI migration: remove old vanilla frontend, verify in browser"
```

---

### Task 13: Update CLAUDE.md decision #5

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (documentation-only task).

- [ ] **Step 1: Rewrite decision #5 in the "Keputusan yang jangan diubah tanpa berpikir" list**

Change:

```
5. **Nol dependency runtime.** Hanya `typescript` dan `@types/node` sebagai devDependency. Frontend sengaja satu file HTML tanpa build step. Kalau mau menambah dependency, pikir dua kali — "kami tidak memasang apa pun yang aneh di mesin kalian" itu argumen nyata ke klien.
```

to:

```
5. **Orchestrator (root) nol dependency runtime.** Hanya `typescript` dan `@types/node` sebagai devDependency di root `package.json` — ini yang menyentuh repo klien, jadi argumen "kami tidak memasang apa pun yang aneh di mesin kalian" tetap berlaku persis di situ. Frontend (`web/`) punya `package.json` sendiri dengan React + Vite dan build step (`npm run build` dari root memicu `vite build` di `web/`) — sengaja dipisah supaya siapa pun yang membaca root `package.json` tidak salah kira agent-runner butuh React. Kalau mau menambah dependency ke root, tetap pikir dua kali; `web/` boleh menambah dependency frontend selama alasannya jelas dan tetap di `web/package.json`, bukan root.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md decision #5 to reflect frontend/orchestrator dependency split"
```

---

## Plan self-review notes

- **Spec coverage**: every section of `docs/superpowers/specs/2026-07-31-react-ui-migration-design.md` maps to a task — stack/structure (Tasks 1, 3), build/dev workflow (Task 2), data flow (Tasks 3–4), full rewrite of all 5 screens + detail (Tasks 5–11), manual verification (Task 12), CLAUDE.md updates (Tasks 12–13), English UI copy (baked into every component task's JSX text).
- **Type consistency checked**: `RunRecord`, `Job`, `StateResponse`, `Metrics`, `ConfigResponse`, `RunDetailResponse` are defined once in Task 3 and referenced by identical names/shapes in Tasks 4, 6–11; `OUTCOME_LABEL` defined once in Task 6, imported (not redefined) in Tasks 7, 8, 11; `reviewItems` defined once in Task 8, imported (not duplicated) in Task 5/9's nav badge wiring.
- **Out of scope, confirmed absent from tasks**: no new backend endpoints, no `guardrails.ts`/`config/pipeline.json` changes, no new UI features, no new test framework.
