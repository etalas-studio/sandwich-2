import type { UserRepository } from "../ports/index.js";
// ponytail: move to PasswordResetRepository port when Task 3 is extended
import { getValidResetToken, markResetTokenUsed } from "../../db/repo/password-resets.js";
import type { Database } from "../../db/connection.js";
// ponytail: path moves to ../../infrastructure/auth/password.js after Task 8 restructures auth/
import { hashPassword } from "../../auth/password.js";

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export class ResetPasswordError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function resetPassword(
  repos: { users: UserRepository },
  // ponytail: db removed when PasswordResetRepository port is added
  db: Database,
  input: ResetPasswordInput,
): Promise<void> {
  const tokenRow = await getValidResetToken(db, input.token);
  if (!tokenRow) {
    throw new ResetPasswordError(400, "invalid or expired token");
  }

  const newHash = await hashPassword(input.newPassword);
  await repos.users.updatePassword(tokenRow.userId, newHash);
  await markResetTokenUsed(db, input.token);
}

// Self-check
const _check: ResetPasswordInput = { token: "t", newPassword: "p" };
void _check;
