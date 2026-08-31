import cors from "cors";
import type { Request, Response, NextFunction, RequestHandler } from "express";

function isTrustedHost(
  hostHeader: string | undefined,
  boundPort: number,
  trusted: Set<string>,
): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  if (trusted.has(host)) return true;
  const loopback = ["127.0.0.1", "localhost", "[::1]"];
  if (loopback.some((name) => host === `${name}:${String(boundPort)}`)) return true;
  if ((boundPort === 80 || boundPort === 443) && loopback.includes(host)) return true;
  return false;
}

function originMatchesHost(
  originHeader: string,
  hostHeader: string | undefined,
  trusted: Set<string>,
): boolean {
  if (!hostHeader) return false;
  let originHost: string;
  try {
    originHost = new URL(originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  return originHost === hostHeader.toLowerCase() || trusted.has(originHost);
}

export function hostGuard(trustedHosts: Set<string>, boundPort: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const port = (req.socket?.localPort ?? boundPort);
    if (!isTrustedHost(req.headers.host, port, trustedHosts)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

export function csrfGuard(trustedHosts: Set<string>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    const isSafe = method === "GET" || method === "HEAD";
    const isPreflight = method === "OPTIONS";
    if (!isSafe && !isPreflight) {
      const origin = req.headers.origin;
      if (
        origin !== undefined &&
        !originMatchesHost(origin, req.headers.host, trustedHosts)
      ) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    }
    next();
  };
}

export function corsMiddleware(trustedHosts: Set<string>): RequestHandler {
  // Match router.ts: CORS_ORIGIN is the primary allowed origin (exact string match)
  const corsOrigin = process.env.CORS_ORIGIN ?? "";
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      // Primary: exact match against CORS_ORIGIN env var (matches original router.ts)
      if (corsOrigin !== "" && origin === corsOrigin) return callback(null, true);
      // Secondary: loopback + trustedHosts set (dev/internal)
      let originHost: string;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        return callback(null, false);
      }
      const allowed =
        originHost === "localhost" ||
        originHost.startsWith("localhost:") ||
        originHost === "127.0.0.1" ||
        originHost.startsWith("127.0.0.1:") ||
        originHost === "[::1]" ||
        originHost.startsWith("[::1]:") ||
        trustedHosts.has(originHost);
      callback(null, allowed);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type"],
    maxAge: 86400,
  });
}
