# Reference URL Style Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a prototype brief contain a reference URL; fetch that page, extract its visual style (colors, fonts, spacing, radii, shadows), and feed it to the build + glowup prompts as the style source. No URL → existing getokui behavior unchanged.

**Architecture:** A new `webref.ts` module detects the URL, fetches the HTML (with SSRF guard + timeout), extracts CSS tokens, and writes `.reference/style.json` + `.reference/page.html` into the temp workspace. `prompts.ts` and `glowup.ts` gain an optional `referenceUrl`; when set, their prompts point the agent at `.reference/` instead of (or in addition to) getokui. `isPrototypeFile` skips `.reference/` so it is never saved to the DB.

**Tech Stack:** TypeScript (Node 22, ESM, global `fetch`), `node:net`/`node:dns`, `node:test`.

## Global Constraints

- Server is ESM (`"type": "module"`), `module`/`moduleResolution` = `NodeNext`, `strict: true`, `noUncheckedIndexedAccess: true`, `rootDir: apps/server`, `outDir: dist`.
- Tests use `node:test` + `node:assert/strict`, files named `*.test.ts`, run via `node --test dist/**/*.test.js` after `tsc`.
- Node >= 22 — global `fetch` and `AbortSignal.timeout` are available.
- `generatePrototype` in `engine.ts` must never fail because of the reference — any fetch failure falls back to getokui.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/prototype/webref.ts` | Create | URL detection, SSRF guard, fetch, CSS token extraction, workspace write |
| `apps/server/prototype/webref.test.ts` | Create | unit tests (pure fns + mocked fetch) |
| `apps/server/prototype/references.ts` | Modify | `isPrototypeFile` skips `.reference/` too |
| `apps/server/prototype/references.test.ts` | Modify | assert `.reference/` skipped |
| `apps/server/prototype/prompts.ts` | Modify | `referenceUrl?` input + reference section |
| `apps/server/prototype/glowup.ts` | Modify | `referenceUrl?` prompt input + reference section |
| `apps/server/prototype/glowup.test.ts` | Modify | assert reference section when URL present |
| `apps/server/prototype/engine.ts` | Modify | detect URL, fetch, write reference, pass through |

---

### Task 1: `webref.ts` pure functions

**Files:**
- Create: `apps/server/prototype/webref.ts` (pure functions only this task)
- Test: `apps/server/prototype/webref.test.ts`

**Interfaces:**
- Produces:
  - `interface CssTokens { colors: string[]; fonts: string[]; spacings: string[]; radii: string[]; shadows: string[] }`
  - `findReferenceUrl(brief: string): string | null`
  - `extractCssTokens(css: string): CssTokens`
  - `isPrivateIp(ip: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/server/prototype/webref.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { findReferenceUrl, extractCssTokens, isPrivateIp } from "./webref.js";

describe("findReferenceUrl", () => {
  it("finds an http(s) url in a brief", () => {
    assert.equal(
      findReferenceUrl("bikinin web kayak https://example.com buat kopi"),
      "https://example.com",
    );
  });

  it("returns null when no url", () => {
    assert.equal(findReferenceUrl("bikinin web buat kopi"), null);
  });

  it("takes the first url and trims trailing punctuation", () => {
    assert.equal(
      findReferenceUrl("liat https://a.com dan https://b.com)."),
      "https://a.com",
    );
  });
});

describe("extractCssTokens", () => {
  it("extracts colors, fonts, spacing, radius, shadow", () => {
    const css = [
      "body { color: #111827; background: rgb(244,235,225); font-family: 'Inter', sans-serif; }",
      ".card { padding: 20px; margin-top: 1rem; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }",
      "h1 { font-size: 3rem; }",
    ].join("\n");
    const t = extractCssTokens(css);
    assert.ok(t.colors.includes("#111827"));
    assert.ok(t.colors.includes("rgb(244,235,225)"));
    assert.ok(t.fonts.includes("Inter"));
    assert.ok(t.spacings.includes("20px"));
    assert.ok(t.spacings.includes("1rem"));
    assert.ok(t.radii.includes("12px"));
    assert.ok(t.shadows.includes("0 4px 8px rgba(0,0,0,0.1)"));
  });

  it("dedupes and caps colors at 30", () => {
    const css = Array.from({ length: 50 }, (_, i) => `a{color:#${String(i).padStart(6, "0")}}`).join("\n");
    const t = extractCssTokens(css);
    assert.equal(t.colors.length, 30);
  });
});

describe("isPrivateIp", () => {
  it("flags private ranges and loopback", () => {
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("10.1.2.3"), true);
    assert.equal(isPrivateIp("172.16.0.1"), true);
    assert.equal(isPrivateIp("192.168.1.1"), true);
    assert.equal(isPrivateIp("169.254.169.254"), true);
    assert.equal(isPrivateIp("::1"), true);
  });

  it("allows public ips", () => {
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("1.1.1.1"), false);
    assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/webref.test.js
```

Expected: FAIL — `Cannot find module './webref.js'`.

- [ ] **Step 3: Write the pure functions**

Create `apps/server/prototype/webref.ts`:

```typescript
export interface CssTokens {
  colors: string[];
  fonts: string[];
  spacings: string[];
  radii: string[];
  shadows: string[];
}

export interface ReferenceStyle {
  url: string;
  html: string;
  tokens: CssTokens;
}

function uniqueCap(items: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}

export function findReferenceUrl(brief: string): string | null {
  const match = /https?:\/\/[^\s"'<>]+/.exec(brief);
  if (!match) return null;
  return match[0].replace(/[),.;!?\]]+$/, "");
}

export function extractCssTokens(css: string): CssTokens {
  const colorMatches = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [];
  const fontMatches = Array.from(css.matchAll(/font-family\s*:\s*([^;}]+)/g), (m) => m[1]!);
  const spacingMatches = Array.from(
    css.matchAll(/(?:padding|margin)(?:-(?:top|right|bottom|left))?\s*:\s*([^;}]+)/g),
    (m) => m[1]!,
  );
  const radiiMatches = Array.from(css.matchAll(/border-radius\s*:\s*([^;}]+)/g), (m) => m[1]!);
  const shadowMatches = Array.from(css.matchAll(/box-shadow\s*:\s*([^;}]+)/g), (m) => m[1]!);

  return {
    colors: uniqueCap(colorMatches, 30),
    fonts: uniqueCap(fontMatches.map((s) => s.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "")), 20),
    spacings: uniqueCap(spacingMatches, 30),
    radii: uniqueCap(radiiMatches, 20),
    shadows: uniqueCap(shadowMatches, 20),
  };
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0 || a >= 224) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/webref.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/webref.ts apps/server/prototype/webref.test.ts
git commit -m "feat: reference URL detection + CSS token extraction"
```

---

### Task 2: SSRF guard + fetch + workspace write

**Files:**
- Modify: `apps/server/prototype/webref.ts`
- Test: `apps/server/prototype/webref.test.ts`

**Interfaces:**
- Produces: `isPrivateHost(hostname: string): Promise<boolean>`, `fetchReferenceStyle(url: string): Promise<ReferenceStyle | null>`, `writeReferenceToWorkspace(workspace: string, style: ReferenceStyle): string`.

- [ ] **Step 1: Write the failing test (append)**

```typescript
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchReferenceStyle, writeReferenceToWorkspace } from "./webref.js";

describe("fetchReferenceStyle", () => {
  it("returns null on fetch failure", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as any;
    assert.equal(await fetchReferenceStyle("https://example.com"), null);
  });

  it("returns null for non-html responses", async () => {
    globalThis.fetch = (async () => new Response("{}", { headers: { "content-type": "application/json" } })) as any;
    assert.equal(await fetchReferenceStyle("https://example.com"), null);
  });

  it("extracts tokens from html", async () => {
    globalThis.fetch = (async () =>
      new Response(
        "<html><style>body{color:#111;font-family:Inter;padding:20px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.2)}</style></html>",
        { headers: { "content-type": "text/html" } },
      )) as any;
    const r = await fetchReferenceStyle("https://example.com");
    assert.ok(r);
    assert.ok(r.tokens.colors.includes("#111"));
    assert.ok(r.tokens.fonts.includes("Inter"));
    assert.ok(r.tokens.radii.includes("8px"));
  });
});

describe("writeReferenceToWorkspace", () => {
  it("writes style.json and page.html into .reference/", () => {
    const ws = mkdtempSync(join(tmpdir(), "ref-"));
    try {
      const dir = writeReferenceToWorkspace(ws, {
        url: "https://example.com",
        html: "<h1>hi</h1>",
        tokens: { colors: ["#111"], fonts: ["Inter"], spacings: [], radii: [], shadows: [] },
      });
      assert.equal(dir, join(ws, ".reference"));
      assert.ok(existsSync(join(dir, "style.json")));
      assert.ok(existsSync(join(dir, "page.html")));
      const json = JSON.parse(readFileSync(join(dir, "style.json"), "utf-8"));
      assert.equal(json.url, "https://example.com");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/webref.test.js
```

Expected: FAIL — `fetchReferenceStyle`/`writeReferenceToWorkspace` not exported.

- [ ] **Step 3: Implement SSRF guard + fetch + write**

Append to `apps/server/prototype/webref.ts`:

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export async function isPrivateHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower === "169.254.169.254") return true;
  if (isIP(hostname)) return isPrivateIp(hostname);
  try {
    const addrs = await lookup(hostname, { all: true });
    return addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return false; // unresolved → let fetch decide
  }
}

export async function fetchReferenceStyle(url: string): Promise<ReferenceStyle | null> {
  try {
    const parsed = new URL(url);
    if (await isPrivateHost(parsed.hostname)) {
      console.warn("[webref] blocked private host:", parsed.hostname);
      return null;
    }

    const res = await fetch(parsed, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    let html = (await res.text()).slice(0, 500_000);

    let css = "";
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      css += m[1] + "\n";
    }

    const linkTags = Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi), (m) => m[0]);
    let fetchedSheets = 0;
    for (const tag of linkTags) {
      if (fetchedSheets >= 5) break;
      const href = /href=["']([^"']+)["']/.exec(tag)?.[1];
      if (!href) continue;
      try {
        const sheetUrl = new URL(href, parsed).toString();
        const sres = await fetch(sheetUrl, { signal: AbortSignal.timeout(10_000) });
        if (sres.ok) {
          css += await sres.text();
          css += "\n";
          fetchedSheets++;
        }
      } catch {
        // best-effort: ignore individual stylesheet failures
      }
    }

    return { url, html, tokens: extractCssTokens(css) };
  } catch {
    return null;
  }
}

export function writeReferenceToWorkspace(workspace: string, style: ReferenceStyle): string {
  const dir = join(workspace, ".reference");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "style.json"), JSON.stringify({ url: style.url, tokens: style.tokens }, null, 2));
  writeFileSync(join(dir, "page.html"), style.html);
  return dir;
}
```

> Note: the top of `webref.ts` gains `import` statements. Place them at the very top of the file (above the interfaces). If `writeReferenceToWorkspace` was already defined at the bottom, keep it there.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsc -p tsconfig.json && node --test dist/prototype/webref.test.js
```

Expected: PASS (note: the fetch-mock tests override `globalThis.fetch`, which is fine in a single process).

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/webref.ts apps/server/prototype/webref.test.ts
git commit -m "feat: fetch reference URL with SSRF guard + write to workspace"
```

---

### Task 3: Prompt changes + `.reference/` skip

**Files:**
- Modify: `apps/server/prototype/references.ts`, `apps/server/prototype/prompts.ts`, `apps/server/prototype/glowup.ts`
- Test: `apps/server/prototype/references.test.ts`, `apps/server/prototype/glowup.test.ts`

**Interfaces:**
- Consumes: `isPrototypeFile` (references.ts), `buildPrototypeSystemPrompt` (prompts.ts), `buildGlowupSystemPrompt` (glowup.ts).
- Produces: `isPrototypeFile` skips `.reference/`; both prompts accept `referenceUrl?: string | null` and emit a reference section when set.

- [ ] **Step 1: Update `isPrototypeFile` to skip dot-prefixed paths**

In `apps/server/prototype/references.ts`, replace:

```typescript
export function isPrototypeFile(relPath: string): boolean {
  if (relPath === ".getokui" || relPath.startsWith(".getokui/")) return false;
  const dot = relPath.lastIndexOf(".");
  const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
  return ALLOWED_EXTENSIONS.has(ext);
}
```

with:

```typescript
export function isPrototypeFile(relPath: string): boolean {
  if (relPath.split("/").some((seg) => seg.startsWith("."))) return false;
  const dot = relPath.lastIndexOf(".");
  const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
  return ALLOWED_EXTENSIONS.has(ext);
}
```

- [ ] **Step 2: Add test assertions in `references.test.ts`**

In the `isPrototypeFile` "rejects" test, add:

```typescript
    assert.equal(isPrototypeFile(".reference/style.json"), false);
    assert.equal(isPrototypeFile(".reference/page.html"), false);
```

- [ ] **Step 3: Update `prompts.ts`**

Add `referenceUrl?: string | null` to `PrototypePromptInput`, and append a reference section to the prompt when `input.referenceUrl` is set.

In `apps/server/prototype/prompts.ts`, change the interface and the returned array:

```typescript
export interface PrototypePromptInput {
  brief: string;
  palette: string | null;
  logoData: string | null;
  referenceUrl?: string | null;
}
```

And after the logo section, insert (before `## Required Pages`):

```typescript
  const referenceSection = input.referenceUrl
    ? [
        `## Reference Website (client-provided style)`,
        `The client wants this prototype to follow the visual style of this reference site: ${input.referenceUrl}`,
        `- Read .reference/style.json for the exact colors, fonts, spacing, radius, and shadow tokens.`,
        `- Read .reference/page.html to understand its hero layout, component shapes, and section rhythm.`,
        `- Use those as your style source (translate Tailwind-like values to plain CSS as needed).`,
        `- KEEP your own content: the brief's product, copy, and data. NEVER copy the reference's headlines, logo, photos, or illustrations.`,
        ``,
      ]
    : [];
```

Then include `...referenceSection` in the returned array right after the logo section line.

- [ ] **Step 4: Update `glowup.ts` prompt**

Change `GlowupPromptInput` to include `referenceUrl?: string | null`, and when set, replace the taste-library process step with a reference-target step.

In `buildGlowupSystemPrompt`, build a variable:

```typescript
  const referenceSection = input.referenceUrl
    ? [
        `## Style Target (client-provided reference website)`,
        `The client wants this prototype styled like: ${input.referenceUrl}`,
        `Read .reference/style.json (exact colors/fonts/spacing/radius/shadow) and .reference/page.html (hero layout, component shapes, section rhythm).`,
        `Apply those tokens to index.html and styles.css, while keeping the getokui hard floors/anti-slop/contrast/icon/motion doctrine below.`,
        ``,
      ]
    : [
        `## The Taste Library (getokui)`,
        `A curated design-reference library is already copied into this workspace at .getokui/.`,
        `- .getokui/index.json — metadata for 213 templates (slug, category, tags, description, colors, fonts, sections).`,
        `- .getokui/dna/<slug>.json — pre-extracted "Design DNA" for each template (real class strings, spacing, radius, shadow, layout, motion).`,
        ``,
      ];
```

And in the "Your Process" step 2, when `input.referenceUrl` is set, change the reference-picking line to read the `.reference/` files. Replace the existing static library block and the process step 2 with these variables. Concretely: the existing prompt has a literal `## The Taste Library (getokui)` block and a process step 2 that says "Read .getokui/index.json and pick 1–3 references...". Replace the literal block with `...referenceSection`, and make process step 2 conditional.

- [ ] **Step 5: Add `glowup.test.ts` assertions**

Append:

```typescript
describe("buildGlowupSystemPrompt with reference", () => {
  const p = buildGlowupSystemPrompt({ brief: "x", referenceUrl: "https://example.com" });
  it("points at the reference, not getokui", () => {
    assert.ok(p.includes(".reference/style.json"));
    assert.ok(p.includes("https://example.com"));
    assert.ok(!p.includes("pick 1–3 references"));
  });
});
```

- [ ] **Step 6: Typecheck + run affected tests**

```bash
npx tsc -p tsconfig.json && node scripts/copy-getokui.mjs >/dev/null && node --test dist/prototype/references.test.js dist/prototype/glowup.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/prototype/references.ts apps/server/prototype/references.test.ts apps/server/prototype/prompts.ts apps/server/prototype/glowup.ts apps/server/prototype/glowup.test.ts
git commit -m "feat: reference URL sections in build + glowup prompts"
```

---

### Task 4: Engine wiring

**Files:**
- Modify: `apps/server/prototype/engine.ts`

**Interfaces:**
- Consumes: `findReferenceUrl`, `fetchReferenceStyle`, `writeReferenceToWorkspace`, `ReferenceStyle` from `./webref.js`; `referenceUrl` param on both prompt functions.

- [ ] **Step 1: Import webref helpers**

In `apps/server/prototype/engine.ts`, add after the existing imports:

```typescript
import { findReferenceUrl, fetchReferenceStyle, writeReferenceToWorkspace, type ReferenceStyle } from "./webref.js";
```

- [ ] **Step 2: Detect + fetch + write the reference before the build prompt**

In `generatePrototype`, immediately after `const workspace = mkdtempSync(...)` and before `const pi = await import(...)`, insert:

```typescript
    // Optional client reference website (style source). Best-effort; fallback to getokui on failure.
    const referenceUrl = findReferenceUrl(prototype.brief);
    let referenceStyle: ReferenceStyle | null = null;
    if (referenceUrl) {
      try {
        referenceStyle = await fetchReferenceStyle(referenceUrl);
        if (referenceStyle) {
          writeReferenceToWorkspace(workspace, referenceStyle);
          console.log("[prototype] reference style extracted:", referenceUrl);
        } else {
          console.warn("[prototype] reference fetch failed, using getokui:", referenceUrl);
        }
      } catch (err) {
        console.warn("[prototype] reference extraction failed, using getokui:", err);
        referenceStyle = null;
      }
    }
```

- [ ] **Step 3: Pass `referenceUrl` to the build prompt**

Change:

```typescript
    const systemPrompt = buildPrototypeSystemPrompt({
      brief: prototype.brief,
      palette: prototype.palette,
      logoData: prototype.logoData,
    });
```

to:

```typescript
    const systemPrompt = buildPrototypeSystemPrompt({
      brief: prototype.brief,
      palette: prototype.palette,
      logoData: prototype.logoData,
      referenceUrl: referenceStyle?.url ?? null,
    });
```

- [ ] **Step 4: Pass `referenceUrl` to glowup**

Change:

```typescript
      await polishWorkspace(workspace, prototype.brief, signal);
```

to:

```typescript
      await polishWorkspace(workspace, prototype.brief, referenceStyle?.url ?? null, signal);
```

And update `polishWorkspace`'s signature/`buildGlowupSystemPrompt` call in `glowup.ts` to accept and forward `referenceUrl`:

```typescript
export async function polishWorkspace(
  workspace: string,
  brief: string,
  referenceUrl: string | null = null,
  signal?: AbortSignal,
): Promise<void> {
  ...
    const promptPromise = session.prompt(buildGlowupSystemPrompt({ brief, referenceUrl }));
  ...
}
```

- [ ] **Step 5: Typecheck + full suite**

```bash
npx tsc -p tsconfig.json --noEmit && npm test
```

Expected: no type errors; `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/prototype/engine.ts apps/server/prototype/glowup.ts
git commit -m "feat: wire reference URL extraction into prototype pipeline"
```

---

## Self-Review

- **Spec coverage:** URL detection + fetch + extraction + SSRF (Tasks 1–2), prompt sections (Task 3), engine wiring + fallback (Task 4), `.reference/` skip (Task 3). Behavior matrix covered.
- **Placeholder scan:** none — concrete code/commands in every step.
- **Type consistency:** `findReferenceUrl(brief)`, `extractCssTokens(css)`, `fetchReferenceStyle(url)`, `writeReferenceToWorkspace(workspace, style)`, `isPrivateIp(ip)`, `isPrivateHost(hostname)`; `referenceUrl?: string | null` on `PrototypePromptInput` and `GlowupPromptInput`; `polishWorkspace(workspace, brief, referenceUrl?, signal?)`. Consistent across tasks.
