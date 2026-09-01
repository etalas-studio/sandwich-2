import type { SessionRepository } from "../ports/index.js";

export interface LogoutInput {
  token: string;
}

export async function logoutUser(
  repos: { sessions: SessionRepository },
  input: LogoutInput,
): Promise<void> {
  await repos.sessions.delete(input.token);
}

// Self-check
const _check: LogoutInput = { token: "t" };
void _check;
