import type { IncomingMessage } from "node:http";

/**
 * Minimal fixed-window in-memory rate limiter. Suitable for a single-instance
 * deployment; resets on restart. Used to guard email endpoints against abuse
 * (brute-force token guessing and email spam).
 */

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export interface RateLimiter {
  /** Returns true when the request is allowed, false when the limit is hit. */
  check: (key: string) => boolean;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, WindowEntry>();

  // Prune expired windows so the map doesn't grow without bound.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.windowStart >= windowMs) {
        hits.delete(key);
      }
    }
  }, windowMs);
  cleanup.unref?.();

  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        hits.set(key, { count: 1, windowStart: now });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
  };
}

/** Best-effort client IP, honoring x-forwarded-for when behind a proxy. */
export function clientIp(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim() !== "") {
    return xff.split(",")[0]!.trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}
