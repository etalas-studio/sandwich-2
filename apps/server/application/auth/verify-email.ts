import type { UserRepository } from "../ports/index.js";
// ponytail: move to EmailVerificationRepository port in a future task
import {
  getValidVerificationToken,
  markVerificationTokenUsed,
} from "../../db/repo/email-verifications.js";
import type { Database } from "../../db/connection.js";

export interface VerifyEmailInput {
  token: string;
}

export class VerifyEmailError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function verifyEmail(
  repos: { users: UserRepository },
  // ponytail: db removed when EmailVerificationRepository port is added
  db: Database,
  input: VerifyEmailInput,
): Promise<void> {
  const tokenRow = await getValidVerificationToken(db, input.token);
  if (!tokenRow) {
    throw new VerifyEmailError(400, "invalid or expired token");
  }

  // ponytail: wrap in transaction (markVerificationTokenUsed then updateEmailVerified) when UnitOfWork port is available
  await markVerificationTokenUsed(db, input.token);
  await repos.users.updateEmailVerified(tokenRow.userId, true);
}

// Self-check
const _check: VerifyEmailInput = { token: "t" };
void _check;
