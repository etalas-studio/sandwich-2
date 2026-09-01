import type { UserRepository, SessionRepository } from "../ports/index.js";
import type { User, Session } from "../../domain/users/index.js";
// ponytail: path moves to ../../infrastructure/auth/password.js after Task 8 restructures auth/
import { hashPassword, verifyPassword } from "../../auth/password.js";

export interface LoginInput {
  identifier: string; // username or email
  password: string;
}

export interface LoginResult {
  user: Pick<User, "id" | "username" | "email" | "role">;
  session: Session;
}

export class LoginError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("dummy-password-for-constant-time-comparison");
  return dummyHashPromise;
}

export async function loginUser(
  repos: { users: UserRepository; sessions: SessionRepository },
  input: LoginInput,
): Promise<LoginResult> {
  const trimmed = input.identifier.trim();
  let user = await repos.users.findByUsername(trimmed);
  if (!user) user = await repos.users.findByEmail(trimmed.toLowerCase());

  if (!user) {
    await getDummyHash().then((hash) => verifyPassword(input.password, hash));
    throw new LoginError(401, "invalid username or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new LoginError(401, "invalid username or password");
  }

  if (!user.emailVerified) {
    throw new LoginError(403, "email not verified");
  }

  const session = await repos.sessions.create({
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });

  return {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    session,
  };
}

// Self-check
const _check: LoginInput = { identifier: "user@example.com", password: "p" };
void _check;
