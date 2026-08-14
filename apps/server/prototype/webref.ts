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
