import {
  acquireProjectLockRemote,
  releaseProjectLockRemote,
  RUN_LOCK_TTL_SECS,
} from "../redis.js";

/**
 * Project lease — serialises generation runs across the conversations in one
 * project (M2-06). Two conversations writing and committing to one git working
 * tree at once corrupts it.
 *
 * Two layers, mirroring the existing in-flight guard:
 *   1. in-process Map — authoritative under the single-instance deployment
 *   2. Redis (compare-and-delete release) — for the multi-instance case
 *
 * Same-conversation re-entry is allowed (the frontend re-POSTs /generate on
 * reconnect); that idempotency is handled by the caller's conversation-level
 * check *before* it asks for a lease.
 */

const RUN_LOCK_TTL_MS = RUN_LOCK_TTL_SECS * 1000;

interface LocalLease {
  conversationId: string;
  acquiredAt: number;
}

const local = new Map<string, LocalLease>();

export interface ProjectLease {
  projectId: string;
  conversationId: string;
  release(): Promise<void>;
}

export type AcquireResult = ProjectLease | { busyWith: string };

export function isLease(r: AcquireResult): r is ProjectLease {
  return "release" in r;
}

/**
 * Attempt to lease `projectId` for `conversationId`. Returns a `ProjectLease`
 * on success (or re-entry, or a stolen stale lease), or `{ busyWith }` when
 * another conversation is actively running in the project.
 */
export async function acquireProjectLease(
  projectId: string,
  conversationId: string,
  now: number = Date.now(),
): Promise<AcquireResult> {
  const held = local.get(projectId);
  if (held && held.conversationId !== conversationId) {
    if (now - held.acquiredAt < RUN_LOCK_TTL_MS) {
      return { busyWith: held.conversationId };
    }
    // Stale — a crashed run must not wedge the project forever. Steal it.
    console.warn(
      `[locks] stealing stale lease on project ${projectId} from ${held.conversationId}`,
    );
  }

  const remote = await acquireProjectLockRemote(projectId, conversationId);
  if (remote) {
    // Redis says another instance owns it. Keep local state honest.
    return remote;
  }

  local.set(projectId, { conversationId, acquiredAt: now });

  let released = false;
  return {
    projectId,
    conversationId,
    async release() {
      if (released) return;
      released = true;
      const cur = local.get(projectId);
      if (cur && cur.conversationId === conversationId) local.delete(projectId);
      await releaseProjectLockRemote(projectId, conversationId);
    },
  };
}

/** Test-only: forget all in-process leases. */
export function __resetLocalLeases(): void {
  local.clear();
}
