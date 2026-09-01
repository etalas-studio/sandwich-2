import type { User, Session } from "../../domain/users/index.js";

export interface UserRepository {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  create(input: { id: string; username: string; email: string; passwordHash: string }): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateEmailVerified(id: string, verified: boolean): Promise<void>;
  ensureAdmin(input: { email: string; passwordHash: string }): Promise<{ created: boolean }>;
}

export interface SessionRepository {
  create(input: { userId: string; expiresAt: Date }): Promise<Session>;
  findByToken(token: string): Promise<Session | undefined>;
  delete(token: string): Promise<void>;
}
