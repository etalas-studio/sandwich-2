import { eq } from "drizzle-orm";
import type { UserRepository, SessionRepository } from "../../application/ports/user-repository.js";
import type { User, Session } from "../../domain/users/index.js";
import type { Database } from "../../db/connection.js";
import { users } from "../../db/schema.js";
import {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  updatePassword,
  ensureAdminUser,
} from "../../db/users.js";
import {
  createSession,
  getSessionByToken,
  deleteSession,
} from "../../db/sessions.js";

function toUser(u: {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  role: string;
  createdAt: Date;
}): User {
  return { ...u, role: u.role as User["role"] };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const u = await getUserById(this.db, id);
    return u ? toUser(u) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const u = await getUserByEmail(this.db, email);
    return u ? toUser(u) : undefined;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const u = await getUserByUsername(this.db, username);
    return u ? toUser(u) : undefined;
  }

  async create(input: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    // createUser generates its own id; port requires caller-supplied id.
    // Insert directly so the caller controls the id.
    await this.db.insert(users).values({
      id: input.id,
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    });
    const u = await getUserById(this.db, input.id);
    if (!u) throw new Error("UserRepository.create: user not found after insert");
    return toUser(u);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await updatePassword(this.db, id, passwordHash);
  }

  async updateEmailVerified(id: string, verified: boolean): Promise<void> {
    await this.db.update(users).set({ emailVerified: verified }).where(eq(users.id, id));
  }

  ensureAdmin(input: { email: string; passwordHash: string }): Promise<{ created: boolean }> {
    return ensureAdminUser(this.db, input);
  }
}

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private db: Database) {}

  async create(input: { userId: string; expiresAt: Date }): Promise<Session> {
    return createSession(this.db, input.userId, input.expiresAt.toISOString());
  }

  async findByToken(token: string): Promise<Session | undefined> {
    return (await getSessionByToken(this.db, token)) ?? undefined;
  }

  async delete(token: string): Promise<void> {
    await deleteSession(this.db, token);
  }
}
