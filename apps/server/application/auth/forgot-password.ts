import type { UserRepository } from "../ports/index.js";
import type { NotificationPort } from "../ports/index.js";
// ponytail: move to PasswordResetRepository port when Task 3 is extended
import { createResetToken } from "../../db/repo/password-resets.js";
import type { Database } from "../../db/connection.js";

export interface ForgotPasswordInput {
  email: string;
}

export async function forgotPassword(
  repos: { users: UserRepository },
  notifications: NotificationPort,
  // ponytail: db removed when PasswordResetRepository port is added
  db: Database,
  input: ForgotPasswordInput,
): Promise<void> {
  const user = await repos.users.findByEmail(input.email.trim().toLowerCase());
  // Always respond ok — do not reveal whether the email exists.
  if (!user) return;

  const token = await createResetToken(db, user.id);
  await notifications.sendPasswordReset(user.email, token);
}

// Self-check
const _check: ForgotPasswordInput = { email: "e@e.com" };
void _check;
