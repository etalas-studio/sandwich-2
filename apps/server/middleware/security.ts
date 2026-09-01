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
    // Match router.ts exactly: CORS_ORIGIN requests are exempt (same as isCorsRequest in router.ts)
    const corsOrigin = process.env.CORS_ORIGIN ?? "";
    const requestOrigin = req.headers.origin ?? "";
    const isCorsRequest = corsOrigin !== "" && requestOrigin === corsOrigin;
    const method = req.method.toUpperCase();
    const isSafe = method === "GET" || method === "HEAD";
    if (!isSafe && !isCorsRequest) {
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

export function corsMiddleware(): RequestHandler {
  // Match router.ts exactly: only CORS_ORIGIN env var is the allowed origin
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      const corsOrigin = process.env.CORS_ORIGIN ?? "";
      callback(null, corsOrigin !== "" && origin === corsOrigin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type"],
    maxAge: 86400,
  });
}
