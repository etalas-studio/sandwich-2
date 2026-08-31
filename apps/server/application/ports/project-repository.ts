import type { Project } from "../../domain/projects/index.js";

export interface ProjectRepository {
  findById(id: string): Promise<Project | undefined>;
  findOwnedById(userId: string, id: string): Promise<Project | undefined>;
  listForUser(userId: string): Promise<Project[]>;
  findOrCreateDefault(userId: string): Promise<Project>;
  create(input: { userId: string; title: string }): Promise<Project>;
  updateTitle(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
}
