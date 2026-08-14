# Reference URL Style Extraction — Design Spec

**Date:** 2026-08-14
**Status:** Approved for planning

## Goal

Let a user paste a reference website URL inside the prototype **brief**, and have
the prototype pipeline adopt that site's **visual style** (colors, fonts, spacing,
radii, shadows, component shapes) while keeping the user's own content. When no
URL is present, behavior stays exactly as today (getokui library auto-pick).

## Scope

- Applies to the **prototype builder** (`/api/prototypes` create + regenerate).
- Style extraction only — **not** a 1:1 clone, and no copying of the reference's
  copy, logos, photos, or brand assets (same `STYLE, NOT CONTENT` rule as getokui).
- One URL per brief is supported (the first `http(s)` URL found).

## Behavior Matrix

| Condition | Style source | Glowup target |
|-----------|--------------|---------------|
| URL present + fetch OK | URL (`.reference/`) | URL (`.reference/`) |
| URL present + fetch fails | getokui library (current) | getokui library (current) |
| No URL | getokui library (current) | getokui library (current) |

The getokui doctrine (hard floors, anti-slop, WCAG contrast, icons, motion) still
applies in **all** cases — it is the quality contract, not the style source.

## Architecture / Data Flow

```
brief = "... https://example.com ..."
  → findReferenceUrl(brief)  →  URL | null
  → (if URL) fetchReferenceStyle(url)
       fetch HTML (timeout 10s, max 500KB)
       collect inline <style> + up to 5 external stylesheets
       extractCssTokens(css) → { colors, fonts, spacings, radii, shadows }
       writeReferenceToWorkspace(workspace, style)
         → workspace/.reference/style.json + workspace/.reference/page.html
  → buildPrototypeSystemPrompt({ brief, palette, logoData, referenceUrl })
       (if referenceUrl) add "Reference Website" section
  → pass-1 build agent
  → copyReferencesTo(workspace)  (getokui, unchanged)
  → polishWorkspace(workspace, brief, referenceUrl, signal)
       (if referenceUrl) glowup targets .reference/ instead of getokui templates
  → readPrototypeFiles(workspace)  (skips .getokui/ AND .reference/)
  → save files → status done
```

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/prototype/webref.ts` | Create | URL detection, fetch, CSS token extraction, workspace write |
| `apps/server/prototype/webref.test.ts` | Create | unit tests (pure functions + mocked fetch) |
| `apps/server/prototype/references.ts` | Modify | `isPrototypeFile` skips `.reference/` too |
| `apps/server/prototype/references.test.ts` | Modify | assert `.reference/` is skipped |
| `apps/server/prototype/prompts.ts` | Modify | add `referenceUrl?` to input + reference section |
| `apps/server/prototype/glowup.ts` | Modify | add `referenceUrl?` to prompt input + reference section |
| `apps/server/prototype/glowup.test.ts` | Modify | assert reference section appears when URL present |
| `apps/server/prototype/engine.ts` | Modify | detect URL, fetch, write reference, pass through |

## Interfaces

```ts
// webref.ts
export interface ReferenceStyle {
  url: string;
  html: string;
  tokens: CssTokens;
}
export interface CssTokens {
  colors: string[];
  fonts: string[];
  spacings: string[];
  radii: string[];
  shadows: string[];
}
export function findReferenceUrl(brief: string): string | null;
export function extractCssTokens(css: string): CssTokens;          // pure
export async function fetchReferenceStyle(url: string): Promise<ReferenceStyle | null>;
export function writeReferenceToWorkspace(workspace: string, style: ReferenceStyle): string;
```

```ts
// prompts.ts
export interface PrototypePromptInput {
  brief: string;
  palette: string | null;
  logoData: string | null;
  referenceUrl?: string | null;
}
```

```ts
// glowup.ts
export interface GlowupPromptInput {
  brief: string;
  referenceUrl?: string | null;
}
export async function polishWorkspace(workspace, brief, referenceUrl?, signal?): Promise<void>;
```

## Extraction Rules

- `findReferenceUrl`: first `https?://` token, trimmed of trailing punctuation
  (`)`, `]`, `,`, `.` not part of the domain). Returns `null` if none.
- `extractCssTokens`:
  - colors: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()` — deduped, capped at 30.
  - fonts: every `font-family` value (first family only) — deduped, capped at 20.
  - spacings: `padding*` and `margin*` values — deduped, capped at 30.
  - radii: `border-radius` values — deduped, capped at 20.
  - shadows: `box-shadow` values — deduped, capped at 20.
- `fetchReferenceStyle`:
  - GET the URL with `fetch`, 10s timeout via `AbortSignal.timeout(10_000)`.
  - Only accept content-type `text/html`; ignore non-HTML responses.
  - Cap the HTML at 500KB before storing.
  - Extract inline `<style>...</style>` blocks, then collect up to 5
    `<link rel="stylesheet" href="...">` (resolve relative URLs against the page
    URL), fetch each with the same 10s timeout, and concatenate into one CSS string.
  - Any individual stylesheet failure is ignored (best-effort).
  - Return `null` if the main page fetch fails, times out, or is non-HTML.

## Prompt Changes

### Build prompt (when `referenceUrl` present)

Add a section:

```
## Reference Website (client-provided style)
The client wants this prototype to follow the visual style of this reference site.
- Read .reference/style.json for the exact colors, fonts, spacing, radius, shadow tokens.
- Read .reference/page.html to understand its hero layout, component shapes, and section rhythm.
- Use those as your style source (translate any Tailwind-like values to plain CSS as needed).
- KEEP your own content: the brief's product, copy, data. NEVER copy the reference's
  headlines, logo, photos, or illustrations.
```

### Glowup prompt (when `referenceUrl` present)

Change the taste-library pointer: instead of "pick 1–3 getokui references from
`.getokui/index.json`", instruct: read `.reference/style.json` + `.reference/page.html`
as the style target, and apply the usual hard floors/anti-slop/contrast/icon/motion
doctrine to match that style. (When no URL, keep the current getokui flow.)

## Error Handling & Security

- Fetch failure/timeout/non-HTML → `fetchReferenceStyle` returns `null` → pipeline
  falls back to getokui behavior and logs a warning. Generation never fails because
  of the reference.
- **SSRF guard:** reject URLs whose hostname resolves to loopback/private/link-local
  ranges (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
  `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`) or whose hostname is exactly
  `169.254.169.254` (cloud metadata). Resolution happens via `dns.promises.lookup`
  with `all: true`; if any resolved address is private, reject.
- `.reference/` files are excluded from DB save (same skip rule as `.getokui/`).

## Testing

- `findReferenceUrl` — URL present/absent, multiple URLs (first wins), trailing punctuation.
- `extractCssTokens` — hex/rgb/hsl colors, font-family, padding/margin, border-radius, box-shadow, dedupe + caps.
- SSRF guard — private hosts rejected (pure classifier + mocked `dns`).
- `isPrototypeFile` — `.reference/style.json` and `.reference/page.html` return false.
- `buildPrototypeSystemPrompt` — reference section present when URL set, absent when null.
- `buildGlowupSystemPrompt` — reference section present when URL set, absent when null.
- `fetchReferenceStyle` — mocked `fetch` success + failure.
- Live e2e — generate a prototype with a brief containing a real reference URL;
  confirm the output stylesheet references colors/fonts extracted from that URL.

## Out of Scope

- Vision/screenshot extraction (future enhancement if fetch-only proves insufficient).
- Multiple reference URLs (first one wins).
- 1:1 cloning or copying reference content/assets.
- Chat-prototype (single-HTML) flow — builder only.
