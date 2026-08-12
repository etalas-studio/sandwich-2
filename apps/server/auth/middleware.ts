import type { IncomingMessage } from "node:http";
import { SESSION_COOKIE_NAME, parseCookies } from "./cookie.js";
import { validateSession } from "./service.js";
import type { Database } from "../db/connection.js";

export async function authenticateRequest(
  db: Database,
  req: IncomingMessage,
): Promise<{ userId: string } | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return validateSession(db, token);
}
