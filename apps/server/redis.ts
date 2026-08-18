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

const INFLIGHT_TTL_SECS = 600; // 10 min — generous upper bound for a generation

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
