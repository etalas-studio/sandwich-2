import { eq } from "drizzle-orm";
import type { ProjectRepository } from "../../application/ports/project-repository.js";
import type { Project } from "../../domain/projects/index.js";
import type { Database } from "../../db/connection.js";
import { projects } from "../../db/schema.js";
import {
  getProject,
  listProjects,
  createProject,
  normaliseTitle,
} from "../../projects/db.js";

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Project | undefined> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, userId: r.userId, title: r.title, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  async findOwnedById(userId: string, id: string): Promise<Project | undefined> {
    return (await getProject(this.db, userId, id)) ?? undefined;
  }

  listForUser(userId: string): Promise<Project[]> {
    return listProjects(this.db, userId);
  }

  create(input: { userId: string; title: string }): Promise<Project> {
    return createProject(this.db, input.userId, { title: input.title });
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await this.db
      .update(projects)
      .set({ title: normaliseTitle(title), updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id));
  }
}
