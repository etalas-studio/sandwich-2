import type Database from "better-sqlite3";
import type { IncomingMessage } from "node:http";
import { SESSION_COOKIE_NAME, parseCookies } from "./cookie.js";
import { validateSession } from "./service.js";

export function authenticateRequest(
  db: Database.Database,
  req: IncomingMessage,
): { userId: string } | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return validateSession(db, token);
}
