import { createUser, getUserByEmail, getUserByUsername, type User } from "../db/users.js";
import { createSession, deleteSession, getSessionByToken, type Session } from "../db/sessions.js";
import { hashPassword, verifyPassword } from "./password.js";
import { sessionExpiryIso } from "./cookie.js";
import type { Database } from "../db/connection.js";

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

let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("dummy-password-for-constant-time-comparison");
  return dummyHashPromise;
}

export async function register(db: Database, input: RegisterInput): Promise<{ user: User }> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await createUser(db, {
      username: input.username,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") {
      throw new AuthError(409, "username or email already taken");
    }
    throw err;
  }
  return { user };
}

export async function resolveUserByIdentifier(
  identifier: string,
  byUsername: (username: string) => Promise<User | null>,
  byEmail: (email: string) => Promise<User | null>,
): Promise<User | null> {
  const trimmed = identifier.trim();
  const user = await byUsername(trimmed);
  if (user) return user;
  return byEmail(trimmed.toLowerCase());
}

export async function login(db: Database, input: Credentials): Promise<AuthResult> {
  const user = await resolveUserByIdentifier(
    input.username,
    (username) => getUserByUsername(db, username),
    (email) => getUserByEmail(db, email),
  );
  if (!user) {
    await getDummyHash().then((hash) => verifyPassword(input.password, hash));
    throw new AuthError(401, "invalid username or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, "invalid username or password");
  }

  if (!user.emailVerified) {
    throw new AuthError(403, "email not verified");
  }

  const session = await createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export async function logout(db: Database, token: string): Promise<void> {
  await deleteSession(db, token);
}

export async function validateSession(db: Database, token: string): Promise<{ userId: string } | null> {
  const session = await getSessionByToken(db, token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSession(db, token);
    return null;
  }

  return { userId: session.userId };
}
