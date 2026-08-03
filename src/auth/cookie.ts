export const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days, fixed (not sliding)

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function buildClearedSessionCookie(secure: boolean): string {
  const attrs = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000).toISOString();
}
