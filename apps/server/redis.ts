import { Redis } from "ioredis";

// REDIS_URL is optional — if unset, pub/sub falls back to in-process mode
// (single instance only). Set it when running multiple server instances.
const url = process.env.REDIS_URL;

let _pub: Redis | null = null;
let _sub: Redis | null = null;

function pub(): Redis | null {
  if (!url) return null;
  if (!_pub) _pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
  return _pub;
}

function sub(): Redis | null {
  if (!url) return null;
  if (!_sub) _sub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
  return _sub;
}

// One source of truth for "how long can a generation run own its locks". The
// prototype engine's own timeout is 10 min; this must exceed it plus margin so
// the marker/lease never expires mid-run and admits a second generation.
export const RUN_LOCK_TTL_SECS = 900; // 15 min
const INFLIGHT_TTL_SECS = RUN_LOCK_TTL_SECS;

export function channelFor(conversationId: string): string {
  return `conv:${conversationId}`;
}

/** Mark a conversation as in-flight across instances. */
export async function markInFlight(conversationId: string): Promise<void> {
  await pub()?.set(`inflight:${conversationId}`, "1", "EX", INFLIGHT_TTL_SECS);
}

/** Remove the in-flight marker and publish a done/abort signal. */
export async function clearInFlight(
  conversationId: string,
  event: string,
): Promise<void> {
  await pub()?.del(`inflight:${conversationId}`);
  await pub()?.publish(channelFor(conversationId), event);
}

/** Returns true if another instance owns this run (Redis key exists but local map doesn't). */
export async function isInFlightRemote(conversationId: string): Promise<boolean> {
  const r = pub();
  if (!r) return false;
  return (await r.exists(`inflight:${conversationId}`)) === 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project lock — serialises generation runs across conversations in one project
// (M2-06). Concurrent commits to one git repo corrupt its state.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try to take the project lock for `conversationId`. Returns the current holder
 * when the project is busy in another conversation, or `null` (acquired /
 * re-entrant / no Redis configured).
 */
export async function acquireProjectLockRemote(
  projectId: string,
  conversationId: string,
): Promise<{ busyWith: string } | null> {
  const r = pub();
  if (!r) return null;
  const key = `project-lock:${projectId}`;
  const ok = await r.set(key, conversationId, "EX", RUN_LOCK_TTL_SECS, "NX");
  if (ok === "OK") return null;
  const holder = await r.get(key);
  if (!holder || holder === conversationId) return null; // re-entrant / just expired
  return { busyWith: holder };
}

/**
 * Release the project lock, but only if `conversationId` still holds it — a
 * plain DEL would let a run whose lease already expired delete the *new*
 * holder's lock. Compare-and-delete via Lua.
 */
export async function releaseProjectLockRemote(
  projectId: string,
  conversationId: string,
): Promise<void> {
  const r = pub();
  if (!r) return;
  await r.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    `project-lock:${projectId}`,
    conversationId,
  );
}

/** Publish an SSE event string to all subscribers for this conversation. */
export async function publishEvent(
  conversationId: string,
  data: string,
): Promise<void> {
  await pub()?.publish(channelFor(conversationId), data);
}

/**
 * Subscribe to SSE events for a conversation.
 * Returns an unsubscribe function.
 */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (data: string) => void,
): () => void {
  const r = sub();
  if (!r) return () => {};
  const channel = channelFor(conversationId);
  r.subscribe(channel);
  const handler = (ch: string, message: string) => {
    if (ch === channel) onMessage(message);
  };
  r.on("message", handler);
  return () => {
    r.off("message", handler);
    r.unsubscribe(channel);
  };
}

export async function closeRedis(): Promise<void> {
  await _pub?.quit();
  await _sub?.quit();
}
