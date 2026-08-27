import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { projects, conversations } from "./schema.js";
import type { Database } from "./connection.js";

export interface Project {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  id?: string;
  title: string;
}

/**
 * Thrown when a caller references a project it does not own (or that does not
 * exist). The two cases are deliberately indistinguishable — no enumeration
 * oracle for project ids, which flow into filesystem paths and preview URLs.
 */
export class ProjectNotFoundError extends Error {
  constructor(message = "project not found") {
    super(message);
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Thrown by `deleteProject` when conversations still reference the project.
 * Cascading project deletion (DB rows + on-disk dir + R2 bundle) is its own
 * roadmap item (M5-03); until then we refuse rather than orphan.
 */
export class ProjectNotEmptyError extends Error {
  constructor(message = "project still has conversations") {
    super(message);
    this.name = "ProjectNotEmptyError";
  }
}

/**
 * The ownership predicate every scoped query uses. Exported so tests can assert
 * that scoping is present (and both bindings correct) without a database.
 */
export function ownedProject(userId: string, id: string): SQL<unknown> {
  return and(eq(projects.userId, userId), eq(projects.id, id))!;
}

const MAX_TITLE_LEN = 80;
const FALLBACK_TITLE = "Untitled project";

/** Collapse whitespace, strip markdown noise, trim to a word boundary. */
export function normaliseTitle(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_TITLE;
  const flat = raw
    .replace(/[`*_#>\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return FALLBACK_TITLE;
  if (flat.length <= MAX_TITLE_LEN) return flat;
  const cut = flat.slice(0, MAX_TITLE_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Derives a project title when a chat auto-creates its project: prefer an
 * explicit conversation title, else fall back to the opening prompt.
 */
export function deriveProjectTitle(title: string | null | undefined, prompt: string): string {
  const fromTitle = title?.trim();
  if (fromTitle) return normaliseTitle(fromTitle);
  return normaliseTitle(prompt);
}

/**
 * Returns the conversation's project id, creating and attaching a project if
 * the conversation predates M1-02 and somehow has none. Post-M1-02 every
 * conversation already has one, so this is a safety net.
 */
export async function ensureProjectForConversation(
  db: Database,
  userId: string,
  conversation: { id: string; projectId: string | null; title: string; prompt: string },
): Promise<string> {
  if (conversation.projectId) return conversation.projectId;
  const project = await createProject(db, userId, {
    title: deriveProjectTitle(conversation.title, conversation.prompt),
  });
  await db
    .update(conversations)
    .set({ projectId: project.id })
    .where(eq(conversations.id, conversation.id));
  return project.id;
}

function normaliseProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createProject(
  db: Database,
  userId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const id = input.id?.trim() || randomUUID();
  const now = new Date();
  await db.insert(projects).values({
    id,
    userId,
    title: normaliseTitle(input.title),
    createdAt: now,
    updatedAt: now,
  });
  return (await getProject(db, userId, id))!;
}

export async function listProjects(db: Database, userId: string): Promise<Project[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    // A project's recency is driven by activity in its conversations, so
    // order by updatedAt (unlike conversations, which order by createdAt).
    .orderBy(desc(projects.updatedAt));
  return rows.map(normaliseProject);
}

export async function getProject(
  db: Database,
  userId: string,
  id: string,
): Promise<Project | null> {
  const rows = await db.select().from(projects).where(ownedProject(userId, id)).limit(1);
  if (rows.length === 0) return null;
  return normaliseProject(rows[0]!);
}

export async function renameProject(
  db: Database,
  userId: string,
  id: string,
  title: string,
): Promise<Project | null> {
  const existing = await getProject(db, userId, id);
  if (!existing) return null;

  await db
    .update(projects)
    .set({ title: normaliseTitle(title), updatedAt: new Date() })
    .where(ownedProject(userId, id));
  return getProject(db, userId, id);
}

/**
 * Deletes an empty project. Throws `ProjectNotEmptyError` if any conversation
 * still points at it — see the note on `ProjectNotEmptyError` (M5-03 owns the
 * full cascade). Returns `false` when the project does not exist / is not owned.
 */
export async function deleteProject(db: Database, userId: string, id: string): Promise<boolean> {
  const existing = await getProject(db, userId, id);
  if (!existing) return false;

  const counted = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(eq(conversations.projectId, id));
  if ((counted[0]?.count ?? 0) > 0) throw new ProjectNotEmptyError();

  await db.delete(projects).where(ownedProject(userId, id));
  return true;
}

/**
 * Conversations grouped by their owning project, newest project first, newest
 * conversation first within each group. Every row is scoped to `userId` via the
 * join on `projects`.
 */
export async function listProjectsWithConversations(
  db: Database,
  userId: string,
): Promise<{ project: Project; conversations: (typeof conversations.$inferSelect)[] }[]> {
  const rows = await db
    .select({ project: projects, conversation: conversations })
    .from(projects)
    .innerJoin(conversations, eq(conversations.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt), desc(conversations.createdAt));

  const groups = new Map<
    string,
    { project: Project; conversations: (typeof conversations.$inferSelect)[] }
  >();
  for (const row of rows) {
    let group = groups.get(row.project.id);
    if (!group) {
      group = { project: normaliseProject(row.project), conversations: [] };
      groups.set(row.project.id, group);
    }
    group.conversations.push(row.conversation);
  }
  return [...groups.values()];
}
