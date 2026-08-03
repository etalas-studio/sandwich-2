import type Database from "better-sqlite3";
import { createUser, getUserByUsername, type User } from "../db/users.js";
import { createSession, deleteSession, getSessionByToken, type Session } from "../db/sessions.js";
import { hashPassword, verifyPassword } from "./password.js";
import { sessionExpiryIso } from "./cookie.js";

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Credentials {
  username: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  email: string;
}

export interface AuthResult {
  user: Pick<User, "username" | "email">;
  session: Session;
}

/**
 * Checked against on every login attempt against an unknown username, so
 * response timing doesn't reveal whether that username exists.
 *
 * Hashing is async now, so this can't be a module-level constant computed at
 * import time. We memoize the *promise* rather than the resolved string:
 * concurrent first-callers all await the same in-flight hash, and every later
 * caller gets an already-resolved promise, so the ~29ms KDF runs exactly once.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("dummy-password-for-constant-time-comparison");
  return dummyHashPromise;
}

function anyUserExists(db: Database.Database): boolean {
  return db.prepare("SELECT 1 FROM users LIMIT 1").get() !== undefined;
}

export function setupRequired(db: Database.Database): boolean {
  return !anyUserExists(db);
}

export async function register(
  db: Database.Database,
  input: RegisterInput,
): Promise<AuthResult> {
  // Hash BEFORE the "has anyone registered yet?" check, not after.
  //
  // This ordering is load-bearing. `anyUserExists` + `createUser` are both
  // synchronous better-sqlite3 calls, so as long as no `await` sits between
  // them, Node's single-threaded run-to-completion semantics make the
  // check-then-insert pair atomic with respect to other register() calls:
  // no second request can be dispatched mid-sequence. Putting the (now async)
  // hash between them would yield to the event loop right in that gap and
  // reintroduce a real double-registration race, where two concurrent
  // requests both observe an empty users table and both try to insert.
  //
  // Wrapping in db.transaction() is not the fix here — better-sqlite3
  // transactions wrap a *synchronous* callback and cannot contain an await.
  const passwordHash = await hashPassword(input.password);

  // No `await` from here to the insert.
  if (anyUserExists(db)) {
    throw new AuthError(409, "setup already completed");
  }

  const user = createUser(db, {
    username: input.username,
    email: input.email,
    passwordHash,
  });
  const session = createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export async function login(db: Database.Database, input: Credentials): Promise<AuthResult> {
  const user = getUserByUsername(db, input.username);
  const hashToCheck = user ? user.passwordHash : await getDummyHash();
  const passwordOk = await verifyPassword(input.password, hashToCheck);

  if (!user || !passwordOk) {
    throw new AuthError(401, "invalid username or password");
  }

  const session = createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export function logout(db: Database.Database, token: string): void {
  deleteSession(db, token);
}

export function validateSession(db: Database.Database, token: string): { userId: string } | null {
  const session = getSessionByToken(db, token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    deleteSession(db, token);
    return null;
  }

  return { userId: session.userId };
}
