import type { UserRepository } from "../ports/index.js";
import type { NotificationPort } from "../ports/index.js";
// ponytail: move to EmailVerificationRepository port in a future task
import { createVerificationToken } from "../../db/repo/email-verifications.js";
import type { Database } from "../../db/connection.js";

export interface ResendVerificationInput {
  userId: string;
}

export async function resendVerification(
  repos: { users: UserRepository },
  notifications: NotificationPort,
  // ponytail: db removed when EmailVerificationRepository port is added
  db: Database,
  input: ResendVerificationInput,
): Promise<void> {
  const user = await repos.users.findById(input.userId);
  // Always respond ok — do not reveal whether user exists.
  if (!user || user.emailVerified) return;

  const token = await createVerificationToken(db, user.id);
  await notifications.sendEmailVerification(user.email, token);
}

// Self-check
const _check: ResendVerificationInput = { userId: "u" };
void _check;
