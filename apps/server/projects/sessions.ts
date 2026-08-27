import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertSafeSegment } from "./workspace.js";

/**
 * Pi agent sessions, one per conversation, persisted as append-only JSONL.
 *
 * Stored OUTSIDE the project directory (its own root under the same volume) so
 * no session file is ever picked up by the agent's `ls` / `read`, committed to
 * the project's git repo, or included in the M5-01 bundle. The transcript of
 * record stays in Postgres; this is just the agent's working memory.
 */

/**
 * Root for per-conversation session stores. Read from the environment on every
 * call (never cached), mirroring `projectsRoot()`.
 *
 *   PI_SESSIONS_ROOT env var, else
 *   /data/pi-sessions          in production (same Railway Volume, sibling of projects)
 *   <repo>/data/pi-sessions    in dev (git-ignored via the existing `data/` rule)
 */
export function piSessionsRoot(): string {
  const fromEnv = process.env.PI_SESSIONS_ROOT?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "/data/pi-sessions";
  return resolve(process.cwd(), "data/pi-sessions");
}

/** The session directory for one conversation. Validates the id segment. */
export function conversationSessionDir(conversationId: string): string {
  assertSafeSegment(conversationId, "conversationId");
  return join(piSessionsRoot(), conversationId);
}

type SessionManagerModule = {
  SessionManager: {
    continueRecent(cwd: string, sessionDir?: string): unknown;
  };
};

/**
 * Opens (resuming if present) the disk-backed session for a conversation, with
 * `cwd` set to the shared project directory. The SessionManager constructor
 * mkdirs the session dir recursively, so no pre-creation is needed.
 */
export async function openConversationSession(
  conversationId: string,
  projectDir: string,
): Promise<unknown> {
  const pi = (await import("@earendil-works/pi-coding-agent")) as unknown as SessionManagerModule;
  return pi.SessionManager.continueRecent(projectDir, conversationSessionDir(conversationId));
}

/** Removes a conversation's session store. Best-effort; never throws. */
export function deleteConversationSession(conversationId: string): void {
  try {
    rmSync(conversationSessionDir(conversationId), { recursive: true, force: true });
  } catch (err) {
    console.warn(
      `[sessions] failed to delete session for conversation ${conversationId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
