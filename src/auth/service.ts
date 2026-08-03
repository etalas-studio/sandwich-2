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
 */
const DUMMY_HASH = hashPassword("dummy-password-for-constant-time-comparison");

function anyUserExists(db: Database.Database): boolean {
  return db.prepare("SELECT 1 FROM users LIMIT 1").get() !== undefined;
}

export function setupRequired(db: Database.Database): boolean {
  return !anyUserExists(db);
}

export function register(db: Database.Database, input: RegisterInput): AuthResult {
  if (anyUserExists(db)) {
    throw new AuthError(409, "setup already completed");
  }

  const user = createUser(db, {
    username: input.username,
    email: input.email,
    passwordHash: hashPassword(input.password),
  });
  const session = createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export function login(db: Database.Database, input: Credentials): AuthResult {
  const user = getUserByUsername(db, input.username);
  const hashToCheck = user ? user.passwordHash : DUMMY_HASH;
  const passwordOk = verifyPassword(input.password, hashToCheck);

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
