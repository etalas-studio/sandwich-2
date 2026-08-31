import type { Response } from "express";
import { AuthError } from "./auth/service.js";

export function sendCaughtErrorExpress(res: Response, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(`[${context}] error:`, err);
    if (!res.headersSent) res.status(500).json({ error: "internal error" });
  }
}
