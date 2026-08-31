import type { ProjectRepository } from "../ports/project-repository.js";
import type { Project } from "../../domain/projects/index.js";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("project not found");
    this.name = "ProjectNotFoundError";
  }
}

export async function listProjects(
  repo: ProjectRepository,
  userId: string,
): Promise<Project[]> {
  return repo.listForUser(userId);
}

export async function getProject(
  repo: ProjectRepository,
  userId: string,
  id: string,
): Promise<Project> {
  const project = await repo.findOwnedById(userId, id);
  if (!project) throw new ProjectNotFoundError();
  return project;
}

export async function createProject(
  repo: ProjectRepository,
  userId: string,
  title: string,
): Promise<Project> {
  return repo.create({ userId, title });
}

export async function renameProject(
  repo: ProjectRepository,
  userId: string,
  id: string,
  title: string,
): Promise<void> {
  const project = await repo.findOwnedById(userId, id);
  if (!project) throw new ProjectNotFoundError();
  await repo.updateTitle(id, title);
}

export async function deleteProject(
  repo: ProjectRepository,
  userId: string,
  id: string,
): Promise<void> {
  const project = await repo.findOwnedById(userId, id);
  if (!project) throw new ProjectNotFoundError();
  await repo.delete(id);
}
