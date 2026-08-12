import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./http-utils.js";

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

export type MiddlewareFn = (req: IncomingMessage, res: ServerResponse) => boolean | void | Promise<boolean | void>;

interface RouteEntry {
  method: string;
  segments: string[];
  handler: RouteHandler;
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

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

export class Router {
  private routes: RouteEntry[] = [];
  private middlwareFn: MiddlewareFn | null = null;
  private trustedHosts: Set<string>;
  private boundPort: number;

  constructor(trustedHosts: Set<string>, boundPort: number) {
    this.trustedHosts = trustedHosts;
    this.boundPort = boundPort;
  }

  use(fn: MiddlewareFn): void {
    this.middlwareFn = fn;
  }

  add(method: string, path: string, handler: RouteHandler): void {
    const segments = path.split("/").filter(Boolean);
    this.routes.push({ method: method.toUpperCase(), segments, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.add("DELETE", path, handler);
  }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const corsOrigin = process.env.CORS_ORIGIN ?? '';
      const requestOrigin = req.headers.origin ?? '';
      const isCorsRequest = corsOrigin !== '' && requestOrigin === corsOrigin;

      // Handle CORS preflight
      if (isCorsRequest && (req.method ?? '') === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': corsOrigin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        });
        res.end();
        return;
      }

      // Host guard — use the socket's actual port (in case boundPort was 0 = pick-free)
      const port = req.socket?.localPort ?? this.boundPort;
      if (!isTrustedHost(req.headers.host, port, this.trustedHosts)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }

      // Attach CORS headers to all responses when origin matches
      if (isCorsRequest) {
        const originalWriteHead = res.writeHead.bind(res);
        // @ts-expect-error overload types are complex
        res.writeHead = (statusCode: number, headers?: Record<string, string>) => {
          return originalWriteHead(statusCode, {
            'access-control-allow-origin': corsOrigin,
            'access-control-allow-credentials': 'true',
            ...headers,
          });
        };
      }

      // Origin / CSRF guard for state-changing methods
      const method = (req.method ?? "GET").toUpperCase();
      const isSafe = method === "GET" || method === "HEAD";
      if (!isSafe) {
        const origin = req.headers.origin;
        if (origin !== undefined && !originMatchesHost(origin, req.headers.host, this.trustedHosts)) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
      }

      // Middleware
      if (this.middlwareFn) {
        const result = await this.middlwareFn(req, res);
        if (result === false) return;
      }

      // Route matching
      const url = req.url ?? "/";
      const path = url.split("?")[0] ?? "/";
      const reqSegs = path.split("/").filter(Boolean);

      for (const route of this.routes) {
        if (route.method !== method) continue;
        const params: Record<string, string> = {};
        let match = true;

        // Wildcard support: a segment starting with * captures the rest
        if (route.segments.some((s) => s.startsWith("*"))) {
          for (let i = 0; i < route.segments.length; i++) {
            const rSeg = route.segments[i]!;
            if (rSeg.startsWith("*")) {
              // Capture the rest of the path (may be empty)
              params[rSeg.slice(1)] = reqSegs.slice(i).join("/");
              break;
            }
            if (i >= reqSegs.length) { match = false; break; }
            const qSeg = reqSegs[i]!;
            if (rSeg.startsWith(":")) {
              params[rSeg.slice(1)] = decodeSafe(qSeg);
            } else if (rSeg.toLowerCase() !== qSeg.toLowerCase()) {
              match = false;
              break;
            }
          }
        } else {
          if (route.segments.length !== reqSegs.length) continue;
          for (let i = 0; i < route.segments.length; i++) {
            const rSeg = route.segments[i]!;
            const qSeg = reqSegs[i]!;
            if (rSeg.startsWith(":")) {
              params[rSeg.slice(1)] = decodeSafe(qSeg);
            } else if (rSeg.toLowerCase() !== qSeg.toLowerCase()) {
              match = false;
              break;
            }
          }
        }
        if (!match) continue;

        try {
          await route.handler(req, res, params);
        } catch (err) {
          console.error("unhandled request error:", err);
          if (!res.headersSent) {
            sendJson(res, 500, { error: "internal error" });
          } else {
            res.destroy();
          }
        }
        return;
      }

      // 405 check — any route matching the path with a different method?
      for (const route of this.routes) {
        if (route.method === method) continue;
        if (route.segments.length !== reqSegs.length) continue;
        let pathMatch = true;
        for (let i = 0; i < route.segments.length; i++) {
          const rSeg = route.segments[i]!;
          const qSeg = reqSegs[i]!;
          if (rSeg.startsWith(":")) continue;
          if (rSeg.toLowerCase() !== qSeg.toLowerCase()) {
            pathMatch = false;
            break;
          }
        }
        if (pathMatch) {
          sendJson(res, 405, { error: "method not allowed" });
          return;
        }
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      console.error("router dispatch error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal error" });
      } else {
        res.destroy();
      }
    }
  }
}
