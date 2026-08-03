import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const KEY_LENGTH = 64;

/**
 * Async scrypt. The synchronous `scryptSync` blocks Node's single event-loop
 * thread for ~29ms per call, which freezes every other in-flight request
 * (API and static alike) for that whole window — an unauthenticated client
 * could hold the server at a low request-per-second ceiling just by hammering
 * login. The callback form runs the KDF on libuv's threadpool instead.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/** Stored format: `scrypt$<salt hex>$<derived key hex>`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(plain, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
