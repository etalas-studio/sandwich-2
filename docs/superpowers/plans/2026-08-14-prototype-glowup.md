# Prototype Glowup (getokui taste polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-generation "glowup" pass to the prototype pipeline that polishes the design of the already-generated static prototype (spacing, color, typography, composition, motion, icons) using the getokui taste library, without changing the existing build prompt or breaking the pipeline on failure.

**Architecture:** Vendor the getokui reference metadata (`index.json` + `dna/*.json`, ~1 MB) into the server. After the existing build agent finishes writing files, copy the references into the same temp workspace, run a **second** Pi agent pass that reads the generated files + references and rewrites them in place (style only, content preserved). Snapshot pass-1 files first so a glowup failure falls back to the original output. The references are copied from `apps/server/prototype/getokui/` to `dist/prototype/getokui/` at build/test time via a small script.

**Tech Stack:** TypeScript (Node 22, ESM), Pi SDK (`@earendil-works/pi-coding-agent`), Node `node:fs`/`node:test`.

## Global Constraints

- Server is ESM (`"type": "module"`), `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `rootDir: apps/server`, `outDir: dist`.
- Tests use `node:test` + `node:assert/strict`, files named `*.test.ts`, run via `node --test dist/**/*.test.js` after `tsc`.
- Node >= 22 (running v22.23.1).
- Runtime entrypoint is `dist/web-server.js`; `dist/` is gitignored and rebuilt. Only `dist/` matters at runtime.
- `tsc` compiles `.ts` only — it does NOT copy `.json`. Vendored JSON must be copied to `dist/` explicitly.
- The existing build pass in `apps/server/prototype/engine.ts` must remain **behaviorally unchanged**; glowup is added strictly after it, with a snapshot fallback.
- The getokui reference DNA expresses values as Tailwind classes. SANDWICH prototypes use plain CSS (no Tailwind) — glowup must translate Tailwind tokens to CSS equivalents.
- Glowup is **style only**: keep the prototype's own copy, demo data, CRUD logic (localStorage), Chart.js usage, and file layout intact.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/prototype/getokui/index.json` | Create (vendored) | getokui template index (213 entries) |
| `apps/server/prototype/getokui/dna/*.json` | Create (vendored) | per-template Design DNA (213 files) |
| `scripts/copy-getokui.mjs` | Create | copy vendored refs → `dist/prototype/getokui/` |
| `package.json` | Modify | add copy step to `build` + `test` scripts |
| `apps/server/prototype/references.ts` | Create | workspace/reference file helpers (pure, testable) |
| `apps/server/prototype/references.test.ts` | Create | unit tests for the helpers |
| `apps/server/prototype/glowup.ts` | Create | glowup system prompt + agent pass |
| `apps/server/prototype/glowup.test.ts` | Create | unit tests for the prompt |
| `apps/server/prototype/engine.ts` | Modify | wire glowup pass + fallback + skip `.getokui/` |

---

### Task 1: Vendor getokui references + build/test copy step

**Files:**
- Create: `apps/server/prototype/getokui/index.json`
- Create: `apps/server/prototype/getokui/dna/*.json`
- Create: `scripts/copy-getokui.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: a committed `apps/server/prototype/getokui/` dir (index.json + dna/) and a `scripts/copy-getokui.mjs` that mirrors it into `dist/prototype/getokui/`.

- [ ] **Step 1: Clone getokui and vendor only index.json + dna**

```bash
cd /tmp && rm -rf getokui && git clone --depth 1 https://github.com/etalas-studio/getokui.git getokui
cd /Users/ihsanaziz/sandwich-2
mkdir -p apps/server/prototype/getokui/dna
cp /tmp/getokui/references/index.json apps/server/prototype/getokui/index.json
cp /tmp/getokui/references/dna/*.json apps/server/prototype/getokui/dna/
```

- [ ] **Step 2: Verify the vendored files**

```bash
ls apps/server/prototype/getokui/index.json
ls apps/server/prototype/getokui/dna | wc -l
```

Expected: `index.json` exists and `dna` contains 213 `.json` files.

- [ ] **Step 3: Write the copy script**

Create `scripts/copy-getokui.mjs`:

```js
import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = new URL("../apps/server/prototype/getokui/", import.meta.url);
const dest = new URL("../dist/prototype/getokui/", import.meta.url);

if (!existsSync(src)) {
  console.error(`getokui references not found at ${src.pathname}`);
  process.exit(1);
}

mkdirSync(new URL("../dist/prototype/", import.meta.url), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("copied getokui references -> dist/prototype/getokui");
```

- [ ] **Step 4: Wire the copy into build + test scripts**

In `package.json`, change:

```json
    "build": "tsc -p tsconfig.json && npm --prefix apps/web run build",
    "test": "tsc -p tsconfig.json && node --test dist/**/*.test.js",
```

to:

```json
    "build": "tsc -p tsconfig.json && node scripts/copy-getokui.mjs && npm --prefix apps/web run build",
    "test": "tsc -p tsconfig.json && node scripts/copy-getokui.mjs && node --test dist/**/*.test.js",
```

- [ ] **Step 5: Run the copy once and verify output**

```bash
npx tsc -p tsconfig.json && node scripts/copy-getokui.mjs
ls dist/prototype/getokui/index.json
ls dist/prototype/getokui/dna | wc -l
```

Expected: copy logs a success line; `dist/prototype/getokui/index.json` exists and `dist/prototype/getokui/dna` has 213 files.

- [ ] **Step 6: Commit**

```bash
git add apps/server/prototype/getokui scripts/copy-getokui.mjs package.json
git commit -m "chore: vendor getokui taste library (index + dna) for prototype glowup"
```

---

### Task 2: Workspace/reference file helpers (`references.ts`)

**Files:**
- Create: `apps/server/prototype/references.ts`
- Test: `apps/server/prototype/references.test.ts`

**Interfaces:**
- Produces:
  - `const ALLOWED_EXTENSIONS: ReadonlySet<string>` — allowed prototype file extensions.
  - `getokuiSourceDir(): string` — resolved path to the vendored `dist/prototype/getokui` dir.
  - `copyReferencesTo(workspace: string, sourceDir?: string): string` — copies the references into `<workspace>/.getokui`, returns that dest path.
  - `isPrototypeFile(relPath: string): boolean` — `false` for `.getokui/…` and non-allowed extensions.
  - `listFilesRecursive(dir: string): string[]` — absolute paths of every file under `dir`.
  - `readPrototypeFiles(workspace: string): { path: string; content: string }[]` — relative path + utf-8 content for every allowed prototype file, excluding `.getokui/`.

- [ ] **Step 1: Write the failing test**

Create `apps/server/prototype/references.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getokuiSourceDir,
  copyReferencesTo,
  isPrototypeFile,
  listFilesRecursive,
  readPrototypeFiles,
} from "./references.js";

describe("getokuiSourceDir", () => {
  it("points at a directory containing index.json", () => {
    const dir = getokuiSourceDir();
    assert.ok(dir.endsWith("getokui"));
    assert.ok(existsSync(join(dir, "index.json")), "index.json should be vendored");
  });
});

describe("copyReferencesTo", () => {
  it("copies index.json and dna files into <workspace>/.getokui", () => {
    const fixture = mkdtempSync(join(tmpdir(), "getokui-fixture-"));
    const workspace = mkdtempSync(join(tmpdir(), "ws-"));
    try {
      mkdirSync(join(fixture, "dna"), { recursive: true });
      writeFileSync(join(fixture, "index.json"), '{"count":1}');
      writeFileSync(join(fixture, "dna", "aero-studio.json"), '{"slug":"aero-studio"}');

      const dest = copyReferencesTo(workspace, fixture);
      assert.equal(dest, join(workspace, ".getokui"));
      assert.ok(existsSync(join(dest, "index.json")));
      assert.ok(existsSync(join(dest, "dna", "aero-studio.json")));
    } finally {
      rmSync(fixture, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("isPrototypeFile", () => {
  it("accepts allowed extensions", () => {
    assert.equal(isPrototypeFile("index.html"), true);
    assert.equal(isPrototypeFile("styles.css"), true);
    assert.equal(isPrototypeFile("script.js"), true);
    assert.equal(isPrototypeFile("assets/logo.png"), true);
    assert.equal(isPrototypeFile("data.json"), true);
  });

  it("rejects getokui references and disallowed extensions", () => {
    assert.equal(isPrototypeFile(".getokui/index.json"), false);
    assert.equal(isPrototypeFile(".getokui/dna/aero-studio.json"), false);
    assert.equal(isPrototypeFile("readme.md"), false);
    assert.equal(isPrototypeFile("notes.txt"), false);
  });
});

describe("listFilesRecursive", () => {
  it("lists files recursively", () => {
    const dir = mkdtempSync(join(tmpdir(), "ls-"));
    try {
      mkdirSync(join(dir, "assets"), { recursive: true });
      writeFileSync(join(dir, "index.html"), "a");
      writeFileSync(join(dir, "assets", "logo.png"), "b");
      const rel = listFilesRecursive(dir).map((f) => f.replace(dir + "/", ""));
      assert.ok(rel.includes("index.html"));
      assert.ok(rel.includes("assets/logo.png"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readPrototypeFiles", () => {
  it("reads allowed files and skips .getokui", () => {
    const dir = mkdtempSync(join(tmpdir(), "read-"));
    try {
      writeFileSync(join(dir, "index.html"), "<h1>hi</h1>");
      mkdirSync(join(dir, ".getokui", "dna"), { recursive: true });
      writeFileSync(join(dir, ".getokui", "index.json"), "{}");
      writeFileSync(join(dir, ".getokui", "dna", "x.json"), "{}");

      const files = readPrototypeFiles(dir);
      assert.equal(files.length, 1);
      assert.equal(files[0]!.path, "index.html");
      assert.equal(files[0]!.content, "<h1>hi</h1>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node scripts/copy-getokui.mjs && node --test dist/prototype/references.test.js
```

Expected: FAIL — `Cannot find module './references.js'`.

- [ ] **Step 3: Write the module**

Create `apps/server/prototype/references.ts`:

```typescript
import { readFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

export function getokuiSourceDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "getokui");
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export function copyReferencesTo(workspace: string, sourceDir = getokuiSourceDir()): string {
  if (!existsSync(sourceDir)) {
    throw new Error(`getokui references not found at ${sourceDir}`);
  }
  const dest = join(workspace, ".getokui");
  copyDirRecursive(sourceDir, dest);
  return dest;
}

export function isPrototypeFile(relPath: string): boolean {
  if (relPath === ".getokui" || relPath.startsWith(".getokui/")) return false;
  const dot = relPath.lastIndexOf(".");
  const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
  return ALLOWED_EXTENSIONS.has(ext);
}

export function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function readPrototypeFiles(workspace: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const fullPath of listFilesRecursive(workspace)) {
    const relPath = relative(workspace, fullPath).split("\\").join("/");
    if (!isPrototypeFile(relPath)) continue;
    results.push({ path: relPath, content: readFileSync(fullPath, "utf-8") });
  }
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node scripts/copy-getokui.mjs && node --test dist/prototype/references.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/references.ts apps/server/prototype/references.test.ts
git commit -m "feat: workspace + getokui reference file helpers for prototype glowup"
```

---

### Task 3: Glowup system prompt (`buildGlowupSystemPrompt`)

**Files:**
- Create: `apps/server/prototype/glowup.ts` (prompt only this task)
- Test: `apps/server/prototype/glowup.test.ts`

**Interfaces:**
- Produces: `buildGlowupSystemPrompt(input: { brief: string }): string` — the full glowup system prompt as a string.
- Consumes (Task 4): `polishWorkspace(workspace: string, brief: string, signal?: AbortSignal): Promise<void>` will live in the same file and call this prompt.

- [ ] **Step 1: Write the failing test**

Create `apps/server/prototype/glowup.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildGlowupSystemPrompt } from "./glowup.js";

describe("buildGlowupSystemPrompt", () => {
  const prompt = buildGlowupSystemPrompt({ brief: "A SaaS for warehouse inventory" });

  it("embeds the client brief", () => {
    assert.ok(prompt.includes("A SaaS for warehouse inventory"));
  });

  it("points the agent at the vendored taste library", () => {
    assert.ok(prompt.includes(".getokui/index.json"));
    assert.ok(prompt.includes(".getokui/dna/"));
  });

  it("mandates style-not-content and stack preservation", () => {
    assert.ok(prompt.includes("STYLE, NOT CONTENT"));
    assert.ok(prompt.includes("plain static HTML"));
    assert.ok(prompt.includes("styles.css"));
    assert.ok(prompt.includes("script.js"));
  });

  it("encodes the hard floors", () => {
    assert.ok(prompt.includes("4.5:1"));
    assert.ok(prompt.includes("padding-block: 5rem"));
    assert.ok(prompt.includes("lucide.createIcons"));
    assert.ok(prompt.includes("0 emoji"));
  });

  it("encodes anti-slop guidance", () => {
    assert.ok(prompt.includes("centered-hero-of-doom"));
    assert.ok(prompt.includes("layout.hero_layout"));
    assert.ok(prompt.includes("composition_techniques"));
  });

  it("ends with the DONE protocol", () => {
    assert.ok(prompt.includes("DONE"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/glowup.test.js
```

Expected: FAIL — `Cannot find module './glowup.js'`.

- [ ] **Step 3: Write the prompt**

Create `apps/server/prototype/glowup.ts`:

```typescript
export interface GlowupPromptInput {
  brief: string;
}

export function buildGlowupSystemPrompt(input: GlowupPromptInput): string {
  return [
    `You are SANDWICH's design-polish pass ("glowup"). A first agent already generated a working multi-page static prototype from the client brief below. Your job is to improve its DESIGN QUALITY only — spacing, color, typography, hierarchy, composition, motion, iconography — while KEEPING its content, copy, data, and functionality intact.`,
    ``,
    `## Client Brief (for reference matching)`,
    input.brief,
    ``,
    `## The Taste Library (getokui)`,
    `A curated design-reference library is already copied into this workspace at .getokui/.`,
    `- .getokui/index.json — metadata for 213 templates (slug, category, tags, description, colors, fonts, sections).`,
    `- .getokui/dna/<slug>.json — pre-extracted "Design DNA" for each template (real class strings, spacing, radius, shadow, layout, motion).`,
    ``,
    `## Your Process`,
    `1. List the workspace files (index.html, dashboard.html, styles.css, script.js, and module pages) and read each one.`,
    `2. Read .getokui/index.json and pick 1–3 references whose category/tags/description best match the brief's vertical and mood.`,
    `3. Read those references' .getokui/dna/<slug>.json files. Extract concrete tokens (layout.hero_layout, hero.h1_classes, hero.cta_classes, spacing.section_padding, radius, shadow, motion.keyframes_css, layout.composition_techniques).`,
    `4. Apply those tokens to the existing files IN PLACE (edit, don't recreate).`,
    ``,
    `## STYLE, NOT CONTENT (MANDATORY)`,
    `- Keep every headline, paragraph, table row, form label, chart, and piece of demo data exactly as it is. Restyle, never rewrite copy.`,
    `- Never copy a reference's text, brand names, logos, photos, or illustrations into the prototype.`,
    `- If a section is empty, use a clearly-marked placeholder (e.g. "[Feature title]"), never the reference's words.`,
    ``,
    `## Preserve the Existing Stack & Structure (MANDATORY)`,
    `- The prototype is plain static HTML + CSS + JS (no Tailwind, no bundler). Keep it that way.`,
    `- Keep the same files and paths. Keep styles.css as the single stylesheet and script.js as the single script. Keep all CRUD interactions (localStorage) and Chart.js usage working.`,
    `- Do NOT add new files unless strictly necessary (e.g. an asset). Do NOT rename or reorganize files.`,
    ``,
    `## Tailwind → CSS Translation (the DNA speaks Tailwind)`,
    `The DNA files express values as Tailwind utility classes. Translate them into equivalent plain CSS in styles.css. Common mapping:`,
    `- text-5xl/text-6xl/text-7xl/text-8xl → font-size: 3rem/3.75rem/4.5rem/6rem`,
    `- text-base/text-lg → font-size: 1rem/1.125rem`,
    `- py-20 → padding-block: 5rem; pt-28 → padding-top: 7rem; pb-24 → padding-bottom: 6rem`,
    `- rounded-full → border-radius: 9999px; rounded-xl → 0.75rem; rounded-2xl → 1rem`,
    `- tracking-tight → letter-spacing: -0.025em; leading-none → line-height: 1; leading-[1.1] → line-height: 1.1`,
    `- font-thin/font-light/font-semibold/font-bold → font-weight: 100/300/600/700`,
    `- uppercase → text-transform: uppercase`,
    `The DNA's motion.keyframes_css is already raw CSS — paste it verbatim into styles.css and wire the triggers (hover states, scroll reveal) using the DNA's motion.techniques.`,
    ``,
    `## Hard Floors (non-negotiable minimums)`,
    `- Every top-level section has at least py-20 (padding-block: 5rem); hero at least pt-28/pb-24.`,
    `- The hero headline is at least text-5xl (3rem); prefer text-6xl/7xl when the DNA shows it.`,
    `- At least 2 real motions: one ambient @keyframes from the DNA AND one interaction (hover or scroll-reveal).`,
    `- Exactly 0 emoji anywhere. Replace any emoji in the UI with Lucide icons via <script src="https://unpkg.com/lucide@latest"></script> + <i data-lucide="..."></i> + lucide.createIcons(). Give each icon an explicit size and palette color.`,
    `- Pick ONE radius scale and ONE shadow token from the DNA and reuse them consistently.`,
    `- Body text contrast meets WCAG AA (≥ 4.5:1). On white, body text must be #475569 or darker (not #94a3b8). Compute risky pairs, don't eyeball.`,
    ``,
    `## Anti-Slop (kill the AI-generated look)`,
    `- Do NOT keep the generic centered-hero-of-doom (centered headline + subline + 2 buttons + blurred purple blob). Reproduce the DNA's layout.hero_layout (split / split-centered / asymmetric) instead.`,
    `- Land at least ONE signature move from layout.composition_techniques (marquee, bento grid, rotated/overlapping elements, oversized type, grain, horizontal scroll).`,
    `- Introduce asymmetry/tension — not everything centered and symmetric.`,
    `- Vary section rhythm (some full-bleed, some contained).`,
    ``,
    `## Output`,
    `Edit the files in place with the write/edit tool. After finishing, respond with ONLY the text "DONE".`,
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/glowup.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/glowup.ts apps/server/prototype/glowup.test.ts
git commit -m "feat: glowup system prompt (getokui taste polish)"
```

---

### Task 4: Glowup agent pass + engine wiring

**Files:**
- Modify: `apps/server/prototype/glowup.ts` (add `polishWorkspace`)
- Modify: `apps/server/prototype/engine.ts` (wire the pass + fallback + skip `.getokui/`)

**Interfaces:**
- Produces: `polishWorkspace(workspace: string, brief: string, signal?: AbortSignal): Promise<void>`.
- Consumes: `buildGlowupSystemPrompt` (Task 3), `copyReferencesTo`, `readPrototypeFiles` (Task 2).

- [ ] **Step 1: Add `polishWorkspace` to `glowup.ts`**

Append to `apps/server/prototype/glowup.ts`:

```typescript
const GLOWUP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function polishWorkspace(
  workspace: string,
  brief: string,
  signal?: AbortSignal,
): Promise<void> {
  const pi = await import("@earendil-works/pi-coding-agent");

  const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null });
  const provider = process.env.OPENCODE_PROVIDER ?? "opencode-go";
  const modelId = process.env.OPENCODE_MODEL ?? "deepseek-v4-pro";
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) {
    throw new Error(`OpenCode model not available: ${provider}/${modelId}`);
  }

  const { session } = await pi.createAgentSession({
    cwd: workspace,
    model: model as any,
    modelRuntime: modelRuntime as any,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
    sessionManager: pi.SessionManager.inMemory(workspace),
    settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
  });

  let errorMessage = "";

  session.subscribe((event: any) => {
    if (signal?.aborted) return;
    if (event.type === "agent_end") {
      if (typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
    }
  });

  try {
    const promptPromise = session.prompt(buildGlowupSystemPrompt({ brief }));
    promptPromise.catch(() => {}); // avoid unhandled rejection on timeout
    await Promise.race([
      promptPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Prototype glowup timed out")), GLOWUP_TIMEOUT_MS),
      ),
    ]);
    // Small delay for agent_end event to propagate
    await new Promise((r) => setTimeout(r, 500));
    session.dispose();

    if (errorMessage) throw new Error(errorMessage);
  } catch (err) {
    session.dispose();
    throw err;
  }
}
```

- [ ] **Step 2: Rewire `engine.ts` imports**

In `apps/server/prototype/engine.ts`, replace the import block:

```typescript
import { mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";

const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);
```

with:

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrototypeSystemPrompt } from "./prompts.js";
import { copyReferencesTo, readPrototypeFiles } from "./references.js";
import { polishWorkspace } from "./glowup.js";
import { savePrototypeFile, updatePrototypeStatus, type Prototype } from "./storage.js";
import type { Database } from "../db/connection.js";
```

- [ ] **Step 3: Remove the now-unused `listFilesRecursive` helper**

In `apps/server/prototype/engine.ts`, delete this function entirely:

```typescript
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
```

- [ ] **Step 4: Insert the glowup pass + fallback into the save flow**

In `apps/server/prototype/engine.ts`, replace this block:

```typescript
    // Read all generated files from workspace
    const files = listFilesRecursive(workspace);
    console.log("[prototype] workspace files:", files.map((f) => relative(workspace, f)));
    console.log("[prototype] agent response (first 500 chars):", responseText.slice(0, 500));
    if (files.length === 0) throw new Error("no files generated");

    for (const fullPath of files) {
      const relPath = relative(workspace, fullPath).split("\\").join("/");
      const dot = relPath.lastIndexOf(".");
      const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = readFileSync(fullPath, "utf-8");
      await savePrototypeFile(db, prototype.id, relPath, content);
    }

    await updatePrototypeStatus(db, prototype.id, "done");
```

with:

```typescript
    // Read pass-1 files (snapshot kept as fallback if glowup fails)
    let files = readPrototypeFiles(workspace);
    console.log("[prototype] generated files:", files.map((f) => f.path));
    console.log("[prototype] agent response (first 500 chars):", responseText.slice(0, 500));
    if (files.length === 0) throw new Error("no files generated");

    // Design polish pass (getokui glowup). Non-destructive: on failure, keep pass-1 files.
    try {
      copyReferencesTo(workspace);
      await polishWorkspace(workspace, prototype.brief, signal);
      const polished = readPrototypeFiles(workspace);
      if (polished.length > 0) files = polished;
      console.log("[prototype] glowup complete");
    } catch (err) {
      console.error("[prototype] glowup failed, keeping original files:", err);
    }

    for (const file of files) {
      await savePrototypeFile(db, prototype.id, file.path, file.content);
    }

    await updatePrototypeStatus(db, prototype.id, "done");
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: `tsc` compiles clean, the copy script runs, and all `node:test` suites pass (including `references.test.js` and `glowup.test.js`).

- [ ] **Step 7: Manual smoke (optional, needs Postgres + API keys + a running server)**

If a full generation is impractical in this environment, skip this step — Task 4's gate is the typecheck + unit suite. Otherwise, create a prototype through the UI/API and confirm: it still generates successfully, `styles.css` reflects getokui tokens (larger hero, no emoji, Lucide icons, `@keyframes`), and CRUD/Chart.js still work in the preview.

- [ ] **Step 8: Commit**

```bash
git add apps/server/prototype/glowup.ts apps/server/prototype/engine.ts
git commit -m "feat: wire getokui glowup pass into prototype pipeline with fallback"
```

---

## Self-Review

- **Spec coverage:** vendoring (Task 1), reference/workspace helpers (Task 2), glowup prompt with hard floors + anti-slop + contrast + icons + motion + Tailwind→CSS translation + style-not-content + stack preservation (Task 3), agent pass + engine wiring + fallback + skip `.getokui/` (Task 4). All user decisions covered: post-processing pass (not touching the build prompt), index+dna only (no 25 MB templates), agent picks references itself (prompt instructs it to match brief).
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `copyReferencesTo(workspace, sourceDir?)`, `readPrototypeFiles(workspace)`, `buildGlowupSystemPrompt({ brief })`, `polishWorkspace(workspace, brief, signal?)` — signatures consistent across tasks; `engine.ts` imports match the exported names.
