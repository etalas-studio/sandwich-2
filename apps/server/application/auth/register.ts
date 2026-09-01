import type { UserRepository } from "../ports/index.js";
import type { User } from "../../domain/users/index.js";
// ponytail: path moves to ../../infrastructure/auth/password.js after Task 8 restructures auth/
import { hashPassword } from "../../auth/password.js";
// ponytail: move to SubscriptionRepository port and wrap in UnitOfWork transaction when available
import { activateSubscription } from "../../db/repo/subscriptions.js";
import type { Database } from "../../db/connection.js";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  user: Pick<User, "id" | "username" | "email" | "role">;
}

export class RegisterError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function registerUser(
  repos: { users: UserRepository },
  // ponytail: db removed when SubscriptionRepository port and UnitOfWork transaction are added
  db: Database,
  input: RegisterInput,
): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await repos.users.create({
      id: crypto.randomUUID(),
      username: input.username,
      email: input.email,
      passwordHash,
    });
    await activateSubscription(db, { userId: user.id, planSlug: "starter" });
  } catch (err) {
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") {
      throw new RegisterError(409, "username or email already taken");
    }
    throw err;
  }

  return { user: { id: user.id, username: user.username, email: user.email, role: user.role } };
}

// Self-check: RegisterInput must have username, email, password
const _check: RegisterInput = { username: "u", email: "e@e.com", password: "p" };
void _check;
