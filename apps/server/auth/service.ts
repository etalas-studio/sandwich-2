import { createUser, getUserByUsername, type User } from "../db/users.js";
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

export async function register(db: Database, input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await createUser(db, {
      username: input.username,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      throw new AuthError(409, "username or email already taken");
    }
    throw err;
  }
  const session = await createSession(db, user.id, sessionExpiryIso());
  return { user: { username: user.username, email: user.email }, session };
}

export async function login(db: Database, input: Credentials): Promise<AuthResult> {
  let user = await getUserByUsername(db, input.username);
  if (!user) {
    await getDummyHash().then((hash) => verifyPassword(input.password, hash));
    throw new AuthError(401, "invalid username or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, "invalid username or password");
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
