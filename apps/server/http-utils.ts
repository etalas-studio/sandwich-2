import type { ServerResponse } from "node:http";
import type { Response } from "express";
import { AuthError } from "./auth/service.js";

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

export function sendCaughtErrorExpress(res: Response, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(`[${context}] error:`, err);
    if (!res.headersSent) res.status(500).json({ error: "internal error" });
  }
}
