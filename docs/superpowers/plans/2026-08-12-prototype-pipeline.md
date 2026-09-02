# Prototype Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone multi-page prototype pipeline — AI generates static HTML/CSS/JS files via Pi SDK, stored in PostgreSQL, served via public shareable links, previewed in dashboard iframe.

**Architecture:** New `apps/server/prototype/` folder with schema, prompts, engine, storage, and routes. Files stored in PostgreSQL (`prototype_files`), served via public `/p/:shareId` route. Pi SDK agent writes files to a workspace, engine reads them back into DB.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Pi SDK (`@earendil-works/pi-coding-agent`), React 19, Vite.

## Global Constraints

- Standalone pipeline (not connected to PRD/ticket pipeline)
- No code editor, no sandbox build — static multi-page HTML/CSS/JS only
- CRUD in generated prototype is simulated (localStorage)
- All generated prototypes MUST include: landing page (non-technical), dashboard (charts via Chart.js CDN), client color palette, client logo, CRUD for every module
- Files stored in PostgreSQL (not filesystem — Railway ephemeral)
- Public share route `/p/:shareId` requires no auth

---

### Task 1: Database Schema

**Files:**
- Modify: `apps/server/db/schema.ts`
- Create: `apps/server/prototype/schema.ts`

**Interfaces:**
- Produces: `prototypes` and `prototypeFiles` table definitions (re-exported from `apps/server/db/schema.ts`)

- [ ] **Step 1: Add tables to schema**

Append to `apps/server/db/schema.ts`:

```typescript
export const prototypes = pgTable("prototypes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  shareId: text("share_id").notNull().unique(),
  name: text("name").notNull(),
  brief: text("brief").notNull(),
  logoData: text("logo_data"),
  palette: text("palette"),
  status: text("status").notNull().default("generating"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const prototypeFiles = pgTable("prototype_files", {
  id: serial("id").primaryKey(),
  prototypeId: text("prototype_id").notNull().references(() => prototypes.id),
  path: text("path").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  uniquePath: uniqueIndex("idx_prototype_files_path").on(table.prototypeId, table.path),
}));
```

- [ ] **Step 2: Re-export in prototype/schema.ts**

Create `apps/server/prototype/schema.ts`:

```typescript
export { prototypes, prototypeFiles } from "../db/schema.js";
```

- [ ] **Step 3: Generate migration**

```bash
DATABASE_URL=postgresql://localhost:5432/sandwich npx drizzle-kit generate --config apps/server/drizzle.config.ts
```

- [ ] **Step 4: Apply migration**

```bash
DATABASE_URL=postgresql://localhost:5432/sandwich npx drizzle-kit migrate --config apps/server/drizzle.config.ts
```

- [ ] **Step 5: Verify tables exist**

```bash
psql -d sandwich -c "\dt" | grep prototype
```

Expected: `prototype_files` and `prototypes` rows.

- [ ] **Step 6: Commit**

```bash
git add apps/server/db/schema.ts apps/server/db/drizzle/ apps/server/prototype/schema.ts
git commit -m "feat: add prototypes and prototype_files tables"
```

---

### Task 2: Storage Module

**Files:**
- Create: `apps/server/prototype/storage.ts`

**Interfaces:**
- Consumes: `prototypes`, `prototypeFiles` from `./schema.js`, `Database` from `../db/connection.js`
- Produces: `createPrototype`, `getPrototype`, `getPrototypeByShareId`, `listPrototypes`, `updatePrototypeStatus`, `savePrototypeFile`, `getPrototypeFiles`, `getPrototypeFile`

- [ ] **Step 1: Write storage.ts**

```typescript
import { eq, and } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import { prototypes, prototypeFiles } from "./schema.js";
import type { Database } from "../db/connection.js";

export interface Prototype {
  id: string;
  userId: string;
  shareId: string;
  name: string;
  brief: string;
  logoData: string | null;
  palette: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrototypeFile {
  id: number;
  prototypeId: string;
  path: string;
  content: string;
  createdAt: string;
}

export interface CreatePrototypeInput {
  userId: string;
  name: string;
  brief: string;
  logoData?: string | null;
  palette?: string | null;
}

export async function createPrototype(db: Database, input: CreatePrototypeInput): Promise<Prototype> {
  const id = randomUUID();
  const shareId = randomBytes(6).toString("hex");
  const now = new Date().toISOString();
  await db.insert(prototypes).values({
    id,
    userId: input.userId,
    shareId,
    name: input.name,
    brief: input.brief,
    logoData: input.logoData ?? null,
    palette: input.palette ?? null,
    status: "generating",
    createdAt: now,
    updatedAt: now,
  });
  return (await getPrototype(db, id))!;
}

export async function getPrototype(db: Database, id: string): Promise<Prototype | null> {
  const rows = await db.select().from(prototypes).where(eq(prototypes.id, id)).limit(1);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getPrototypeByShareId(db: Database, shareId: string): Promise<Prototype | null> {
  const rows = await db.select().from(prototypes).where(eq(prototypes.shareId, shareId)).limit(1);
  return rows.length > 0 ? rows[0]! : null;
}

export async function listPrototypes(db: Database, userId: string): Promise<Prototype[]> {
  return db.select().from(prototypes).where(eq(prototypes.userId, userId));
}

export async function updatePrototypeStatus(db: Database, id: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  await db.update(prototypes).set({ status, updatedAt: now }).where(eq(prototypes.id, id));
}

export async function savePrototypeFile(db: Database, prototypeId: string, path: string, content: string): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(prototypeFiles).values({
    prototypeId,
    path,
    content,
    createdAt: now,
  }).onConflictDoUpdate({
    target: [prototypeFiles.prototypeId, prototypeFiles.path],
    set: { content, createdAt: now },
  });
}

export async function getPrototypeFiles(db: Database, prototypeId: string): Promise<PrototypeFile[]> {
  return db.select().from(prototypeFiles).where(eq(prototypeFiles.prototypeId, prototypeId));
}

export async function getPrototypeFile(db: Database, prototypeId: string, path: string): Promise<PrototypeFile | null> {
  const rows = await db.select().from(prototypeFiles)
    .where(and(eq(prototypeFiles.prototypeId, prototypeId), eq(prototypeFiles.path, path)))
    .limit(1);
  return rows.length > 0 ? rows[0]! : null;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/prototype/storage.ts
git commit -m "feat: prototype storage module"
```

---

### Task 3: Prompts Module

**Files:**
- Create: `apps/server/prototype/prompts.ts`

**Interfaces:**
- Produces: `buildPrototypeSystemPrompt(input: { brief: string; palette: string | null; logoData: string | null }): string`

- [ ] **Step 1: Write prompts.ts**

```typescript
export interface PrototypePromptInput {
  brief: string;
  palette: string | null;
  logoData: string | null;
}

export function buildPrototypeSystemPrompt(input: PrototypePromptInput): string {
  const paletteSection = input.palette
    ? `## Color Palette (client-provided)\nUse these exact colors as CSS variables:\n${input.palette}\n`
    : `## Color Palette\nChoose a professional palette that fits the brief. Define them as CSS variables in styles.css.\n`;

  const logoSection = input.logoData
    ? `## Logo (client-provided)\nThe client logo is provided as: ${input.logoData}. Embed it in the header and favicon.\n`
    : `## Logo\nCreate a simple text-based logo placeholder that fits the brand.\n`;

  return [
    `You are Spectr, an expert prototype builder. You generate complete, production-quality static prototypes.`,
    ``,
    `## Client Brief`,
    input.brief,
    ``,
    paletteSection,
    ``,
    logoSection,
    ``,
    `## Required Pages`,
    `Generate a MULTI-PAGE static prototype (separate HTML files, no build step, no frameworks).`,
    ``,
    `1. **Landing page** (index.html) — end-user focused, NON-technical copywriting. Explain benefits, not implementation. Hero, features, pricing, footer.`,
    `2. **Dashboard** (dashboard.html) — business-focused with LOTS of charts and metrics. Use Chart.js from CDN (https://cdn.jsdelivr.net/npm/chart.js). Include KPI cards, bar/line/pie charts, activity table. Make metrics relevant to the brief requirements.`,
    `3. **Module pages** — every module/menu mentioned in the brief gets its own page (e.g. users.html, orders.html, products.html).`,
    ``,
    `## CRUD Requirements (CRITICAL)`,
    `EVERY module page MUST include a complete CRUD flow:`,
    `- A table/list showing existing records (seeded with realistic demo data)`,
    `- An "Add" button opening a form with ALL relevant input fields`,
    `- Edit and Delete buttons on each row`,
    `- Data persistence via localStorage (simulated backend)`,
    `- Shared JavaScript in script.js for CRUD operations`,
    ``,
    `## Shared Assets`,
    `- styles.css — shared styles, CSS variables for colors`,
    `- script.js — shared JS (CRUD helpers, navigation, chart rendering)`,
    ``,
    `## Technical Rules`,
    `- Pure static files: HTML, CSS, JavaScript. No frameworks, no bundler.`,
    `- Chart.js loaded from CDN (single script tag).`,
    `- Responsive design (mobile + desktop).`,
    `- All CSS in styles.css, all JS in script.js, minimal inline styles.`,
    `- Write clean, semantic, accessible HTML.`,
    ``,
    `## Output Instructions`,
    `Create the files in the workspace directory using the write tool.`,
    `Create: index.html, dashboard.html, styles.css, script.js, and one HTML file per module.`,
    `Start by listing the files you will create, then write each one.`,
    `After writing all files, respond with ONLY the text "DONE".`,
  ].join("\n");
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/prototype/prompts.ts
git commit -m "feat: prototype prompt builder"
```

---

### Task 4: Engine Module

**Files:**
- Create: `apps/server/prototype/engine.ts`

**Interfaces:**
- Consumes: `buildPrototypeSystemPrompt` from `./prompts.js`, Pi SDK, `savePrototypeFile`/`updatePrototypeStatus` from `./storage.js`
- Produces: `generatePrototype(db, prototype, signal): Promise<void>`

- [ ] **Step 1: Write engine.ts**

```typescript
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico"]);

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export async function generatePrototype(
  db: Database,
  prototype: Prototype,
  signal?: AbortSignal,
): Promise<void> {
  const pi = await import("@earendil-works/pi-coding-agent");

  const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null });
  const model = modelRuntime.getModel("opencode-go", "gpt-5.1");
  if (!model) throw new Error("OpenCode model not available");

  // Workspace dir where the agent writes files
  const workspace = mkdtempSync(join(tmpdir(), "prototype-"));

  try {
    const { session } = await pi.createAgentSession({
      cwd: workspace,
      model: model as any,
      modelRuntime: modelRuntime as any,
      tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
      sessionManager: pi.SessionManager.inMemory(),
      settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
    });

    const systemPrompt = buildPrototypeSystemPrompt({
      brief: prototype.brief,
      palette: prototype.palette,
      logoData: prototype.logoData,
    });

    let done = false;
    let errorMessage = "";

    session.subscribe((event: any) => {
      if (signal?.aborted) return;
      if (event.type === "agent_end") {
        done = true;
        if (typeof event.errorMessage === "string" && event.errorMessage) {
          errorMessage = event.errorMessage;
        }
      }
    });

    // Send the prompt
    const { prompt } = await session.prompt(systemPrompt);
    await prompt;

    // Wait for agent_end (poll with timeout)
    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000; // 5 min
    while (!done && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 500));
      if (signal?.aborted) throw new Error("aborted");
    }

    if (errorMessage) throw new Error(errorMessage);
    if (!done) throw new Error("generation timed out");

    // Read all generated files
    const files = listFilesRecursive(workspace);
    if (files.length === 0) throw new Error("no files generated");

    for (const fullPath of files) {
      const relPath = relative(workspace, fullPath);
      const ext = "." + relPath.split(".").pop()!.toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = readFileSync(fullPath, "utf-8");
      await savePrototypeFile(db, prototype.id, relPath, content);
    }

    await updatePrototypeStatus(db, prototype.id, "done");
  } catch (err) {
    await updatePrototypeStatus(db, prototype.id, "failed");
    throw err;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. (Note: Pi SDK types may need `as any` casts.)

- [ ] **Step 3: Commit**

```bash
git add apps/server/prototype/engine.ts
git commit -m "feat: prototype generation engine via Pi SDK"
```

---

### Task 5: Routes Module

**Files:**
- Create: `apps/server/prototype/routes.ts`

**Interfaces:**
- Consumes: storage + engine functions, `authenticateRequest`
- Produces: `registerPrototypeRoutes(router, db)` and `registerPrototypePublicRoutes(router, db)`

- [ ] **Step 1: Write routes.ts**

```typescript
import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import {
  createPrototype,
  getPrototype,
  getPrototypeByShareId,
  listPrototypes,
  getPrototypeFiles,
  getPrototypeFile,
} from "./storage.js";
import { generatePrototype } from "./engine.js";
import type { Database } from "../db/connection.js";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

export function registerPrototypeRoutes(router: Router, db: Database): void {
  // Create prototype + kick off generation (async)
  router.post("/api/prototypes", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      name?: string;
      brief?: string;
      logoData?: string | null;
      palette?: string | null;
    } | null;

    if (!body || !body.name?.trim() || !body.brief?.trim()) {
      sendJson(res, 400, { error: "name and brief are required" });
      return;
    }

    const proto = await createPrototype(db, {
      userId: auth.userId,
      name: body.name.trim(),
      brief: body.brief.trim(),
      logoData: body.logoData ?? null,
      palette: body.palette ?? null,
    });

    // Kick off generation in background (don't block response)
    generatePrototype(db, proto).catch((err) => {
      console.error("[prototype] generation failed:", err);
    });

    sendJson(res, 201, proto);
  });

  // List prototypes
  router.get("/api/prototypes", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, await listPrototypes(db, auth.userId));
  });

  // Get prototype
  router.get("/api/prototypes/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const proto = await getPrototype(db, params.id!);
    if (!proto) {
      sendJson(res, 404, { error: "prototype not found" });
      return;
    }
    sendJson(res, 200, proto);
  });

  // Regenerate / iterate via chat
  router.post("/api/prototypes/:id/regenerate", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const proto = await getPrototype(db, params.id!);
    if (!proto) {
      sendJson(res, 404, { error: "prototype not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      instruction?: string;
    } | null;

    const updatedBrief = body?.instruction
      ? `${proto.brief}\n\n## Revision Request\n${body.instruction}`
      : proto.brief;

    await db.update(
      // @ts-ignore — direct schema import
      (await import("../db/schema.js")).prototypes,
    ).set({ brief: updatedBrief, status: "generating" }).where(
      // @ts-ignore
      (await import("drizzle-orm")).eq((await import("../db/schema.js")).prototypes.id, proto.id),
    );

    const updated = (await getPrototype(db, proto.id))!;
    generatePrototype(db, updated).catch((err) => {
      console.error("[prototype] regeneration failed:", err);
    });

    sendJson(res, 200, { regenerating: true });
  });
}

export function registerPrototypePublicRoutes(router: Router, db: Database): void {
  // Serve prototype index (public share link)
  router.get("/p/:shareId", async (_req, res, params) => {
    const proto = await getPrototypeByShareId(db, params.shareId!);
    if (!proto) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const indexFile = await getPrototypeFile(db, proto.id, "index.html");
    if (!indexFile) {
      sendJson(res, 404, { error: "index.html not found" });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(indexFile.content);
  });

  // Serve individual prototype files (public)
  router.get("/p/:shareId/*path", async (_req, res, params) => {
    const proto = await getPrototypeByShareId(db, params.shareId!);
    if (!proto) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const file = await getPrototypeFile(db, proto.id, params.path!);
    if (!file) {
      sendJson(res, 404, { error: "file not found" });
      return;
    }
    const ext = "." + file.path.split(".").pop()!.toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
    res.end(file.content);
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/prototype/routes.ts
git commit -m "feat: prototype API routes + public share serving"
```

---

### Task 6: Wire into Web Server

**Files:**
- Modify: `apps/server/web-server.ts`

- [ ] **Step 1: Import and register routes**

In `apps/server/web-server.ts`, add imports:

```typescript
import { registerPrototypeRoutes, registerPrototypePublicRoutes } from "./prototype/routes.js";
```

Add public paths:
```typescript
const PUBLIC_API_PATHS = new Set([
  // ... existing ...
  "/api/auth/logout",
  "/api/midtrans/notification",
]);
// Public prototype paths are NOT under /api — handled by public route registration
```

Register routes (after existing registrations):
```typescript
registerPrototypeRoutes(router, db);
registerPrototypePublicRoutes(router, db);
```

- [ ] **Step 2: Ensure /p/* paths bypass auth middleware**

The auth middleware only gates `/api/*` paths, so `/p/:shareId` is already public. No change needed to middleware.

- [ ] **Step 3: Typecheck + start server**

```bash
npx tsc --noEmit && npx tsx apps/server/web-server.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/web-server.ts
git commit -m "feat: wire prototype routes into web server"
```

---

### Task 7: Frontend — Prototype View

**Files:**
- Create: `apps/web/src/components/PrototypeView.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx` (add "New Prototype" entry point)

**Interfaces:**
- Consumes: `/api/prototypes` endpoints, `useSubscription`
- Produces: `PrototypeView` component (form + preview iframe + chat iteration)

- [ ] **Step 1: Write PrototypeView.tsx**

```typescript
import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";

interface Prototype {
  id: string;
  shareId: string;
  name: string;
  brief: string;
  status: string;
  createdAt: string;
}

function PrototypeForm({ onCreated }: { onCreated: (p: Prototype) => void }) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [palette, setPalette] = useState("");
  const [logoData, setLogoData] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !brief.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/prototypes"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brief: brief.trim(),
          palette: palette.trim() || null,
          logoData: logoData.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const proto = (await res.json()) as Prototype;
      onCreated(proto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6" style={{ backgroundColor: "#F4EBE1", minHeight: "100vh" }}>
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'Bowlby One', system-ui", color: "#111827" }}>
        New Prototype
      </h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="My App Prototype"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Brief (describe your product)</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            rows={6}
            placeholder="A SaaS for managing warehouse inventory..."
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Color palette (hex codes, comma-separated)</label>
          <input
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="#f91814, #111827, #F4EBE1"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Logo (URL or description)</label>
          <input
            value={logoData}
            onChange={(e) => setLogoData(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="https://example.com/logo.png or 'a red circle with letter S'"
          />
        </div>
        {error && <p className="text-sm" style={{ color: "#f91814" }}>{error}</p>}
        <button
          onClick={submit}
          disabled={submitting}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: "#111827", opacity: submitting ? 0.5 : 1 }}
        >
          {submitting ? "Generating..." : "Generate Prototype"}
        </button>
      </div>
    </div>
  );
}

export default function PrototypeView() {
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [active, setActive] = useState<Prototype | null>(null);
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/prototypes"), { credentials: "include" })
      .then((r) => r.json())
      .then(setPrototypes)
      .catch(() => {});
  }, []);

  const regenerate = async () => {
    if (!active || !instruction.trim()) return;
    await fetch(apiUrl(`/api/prototypes/${active.id}/regenerate`), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction: instruction.trim() }),
    });
    setInstruction("");
    // Reload after a delay
    setTimeout(() => {
      const iframe = document.getElementById("prototype-preview") as HTMLIFrameElement | null;
      iframe?.contentWindow?.location.reload();
    }, 3000);
  };

  if (active) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 p-4 border-b" style={{ backgroundColor: "#fff" }}>
          <button onClick={() => setActive(null)} className="text-sm">← Back</button>
          <span className="font-semibold">{active.name}</span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: active.status === "done" ? "#dcfce7" : "#fef3c7", color: active.status === "done" ? "#16a34a" : "#b45309" }}>
            {active.status}
          </span>
          <a href={`/p/${active.shareId}`} target="_blank" className="text-sm underline ml-auto">Share link</a>
        </div>
        <div className="flex-1 flex">
          <div className="flex-1">
            <iframe
              id="prototype-preview"
              src={`/p/${active.shareId}`}
              className="w-full h-full border-0"
              title="prototype preview"
            />
          </div>
          <div className="w-80 border-l p-4 flex flex-col" style={{ backgroundColor: "#F4EBE1" }}>
            <h3 className="font-semibold mb-3">Iterate</h3>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border mb-3"
              rows={4}
              placeholder="Change the dashboard chart to a line chart..."
            />
            <button
              onClick={regenerate}
              className="px-4 py-2 rounded-full text-white font-semibold"
              style={{ backgroundColor: "#f91814" }}
            >
              Apply Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#F4EBE1", minHeight: "100vh" }}>
      <PrototypeForm onCreated={(p) => { setPrototypes([p, ...prototypes]); setActive(p); }} />
      {prototypes.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-8">
          <h2 className="text-xl mb-4 font-semibold">Your Prototypes</h2>
          <div className="flex flex-col gap-3">
            {prototypes.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className="flex items-center justify-between p-4 rounded-xl bg-white border"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs" style={{ color: p.status === "done" ? "#16a34a" : "#b45309" }}>{p.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

```typescript
import PrototypeView from "./components/PrototypeView";
// ...
<Route path="/prototype" element={<PrototypeView />} />
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/PrototypeView.tsx apps/web/src/App.tsx
git commit -m "feat: prototype view with form, preview, and chat iteration"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Start servers**

```bash
npx tsx apps/server/web-server.ts
npm run dev:web
```

- [ ] **Step 2: Test create prototype (simulate — may fail without AI key)**

```bash
curl -X POST http://localhost:4319/api/prototypes \
  -H "content-type: application/json" \
  -H "cookie: session=<your-session>" \
  -d '{"name":"Test","brief":"Inventory SaaS"}'
```

Expected: returns prototype object with `shareId`.

- [ ] **Step 3: Verify share link**

Open `http://localhost:4319/p/<shareId>` — should serve `index.html` once generated.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: e2e verification fixes"
```
