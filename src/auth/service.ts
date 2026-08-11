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

export async function register(db: Database.Database, input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = createUser(db, {
      username: input.username,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new AuthError(409, "username or email already taken");
    }
    throw err;
  }
  const session = createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export async function login(db: Database.Database, input: Credentials): Promise<AuthResult> {
  let user = getUserByUsername(db, input.username);
  if (!user) {
    await getDummyHash().then((hash) => verifyPassword(input.password, hash));
    throw new AuthError(401, "invalid username or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
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
