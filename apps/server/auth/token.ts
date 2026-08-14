import { createHash } from "node:crypto";

/**
 * One-way hash for short-lived tokens (password reset, email verification).
 * The raw token goes in the emailed link; only this hash is stored in the DB,
 * so a database leak does not expose usable tokens.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
