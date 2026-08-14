import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { captureVisualStyle } from "./screenshot.js";

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
  visualDescription?: string;
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

/** Returns every unique http(s) URL found in the brief (in order). */
export function findReferenceUrls(brief: string): string[] {
  const matches = brief.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[),.;!?\]]+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Backwards-compatible helper: returns the first URL, or null. */
export function findReferenceUrl(brief: string): string | null {
  return findReferenceUrls(brief)[0] ?? null;
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

    const visualDescription = await captureVisualStyle(url).catch(() => null);
    return {
      url,
      html,
      tokens: extractCssTokens(css),
      ...(visualDescription ? { visualDescription } : {}),
    };
  } catch {
    return null;
  }
}

export function writeReferenceToWorkspace(workspace: string, style: ReferenceStyle): string {
  const dir = join(workspace, ".reference");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "style.json"),
    JSON.stringify(
      { url: style.url, tokens: style.tokens, ...(style.visualDescription ? { visualDescription: style.visualDescription } : {}) },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "page.html"), style.html);
  return dir;
}

/** Fetch all reference URLs (best-effort — failed/unusable ones are skipped). */
export async function fetchReferenceStyles(urls: string[]): Promise<ReferenceStyle[]> {
  const styles: ReferenceStyle[] = [];
  for (const url of urls) {
    const style = await fetchReferenceStyle(url);
    if (style) styles.push(style);
  }
  return styles;
}

/** Write multiple references into `.reference/<i>/` plus an `index.json`. */
export function writeReferencesToWorkspace(workspace: string, styles: ReferenceStyle[]): string {
  const dir = join(workspace, ".reference");
  mkdirSync(dir, { recursive: true });
  styles.forEach((style, i) => {
    const subdir = join(dir, String(i));
    mkdirSync(subdir, { recursive: true });
    writeFileSync(
      join(subdir, "style.json"),
      JSON.stringify(
        { url: style.url, tokens: style.tokens, ...(style.visualDescription ? { visualDescription: style.visualDescription } : {}) },
        null,
        2,
      ),
    );
    writeFileSync(join(subdir, "page.html"), style.html);
  });
  writeFileSync(join(dir, "index.json"), JSON.stringify(styles.map((s) => s.url), null, 2));
  return dir;
}
