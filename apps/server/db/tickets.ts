import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { tickets } from "./schema.js";
import type { Database } from "./connection.js";

export interface Ticket {
  key: string;
  type: string | null;
  summary: string | null;
  description: string;
  url: string | null;
  status: string;
  stage: string | null;
  needsHumanCategory: string | null;
  needsHumanReason: string | null;
  prUrl: string | null;
  prSummary: string | null;
  prTitle: string | null;
  prDescription: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  worktreePath: string | null;
  branchName: string | null;
  quickWinChoices: string | null;
  quickWinAttempts: number;
  issueType: string | null;
  priority: string | null;
  sprint: string | null;
  storyPoints: number | null;
  team: string | null;
  assignee: string | null;
  parentKey: string | null;
  attachments: string | null;
  jiraStatus: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  id: string;
  summary?: string;
  description: string;
  url: string | null;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
}

function normaliseTicket(row: typeof tickets.$inferSelect): Ticket {
  return {
    key: row.key,
    type: row.type,
    summary: row.summary,
    description: row.description,
    url: row.url,
    status: row.status,
    stage: row.stage,
    needsHumanCategory: row.needsHumanCategory,
    needsHumanReason: row.needsHumanReason,
    prUrl: row.prUrl,
    prSummary: row.prSummary,
    prTitle: row.prTitle,
    prDescription: row.prDescription,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    worktreePath: row.worktreePath,
    branchName: row.branchName,
    quickWinChoices: row.quickWinChoices,
    quickWinAttempts: row.quickWinAttempts ?? 0,
    issueType: row.issueType,
    priority: row.priority,
    sprint: row.sprint,
    storyPoints: row.storyPoints,
    team: row.team,
    assignee: row.assignee,
    parentKey: row.parentKey,
    attachments: row.attachments,
    jiraStatus: row.jiraStatus,
    feedback: row.feedback,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTicket(db: Database, input: CreateTicketInput): Promise<Ticket> {
  if (!input.description.trim()) throw new Error("description must not be empty");
  const key = input.id.trim() || `T-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  await db.insert(tickets).values({
    key,
    summary: input.summary ?? null,
    description: input.description,
    url: input.url,
    status: "backlog",
    createdAt: now,
    updatedAt: now,
    issueType: input.issueType ?? null,
    priority: input.priority ?? null,
    sprint: input.sprint ?? null,
    storyPoints: input.storyPoints ?? null,
    team: input.team ?? null,
    assignee: input.assignee ?? null,
    parentKey: input.parentKey ?? null,
    attachments: input.attachments ?? null,
  });
  return (await getTicket(db, key))!;
}

export async function listTickets(db: Database): Promise<Ticket[]> {
  const rows = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  return rows.map(normaliseTicket);
}

export async function getTicket(db: Database, key: string): Promise<Ticket | null> {
  const rows = await db.select().from(tickets).where(eq(tickets.key, key)).limit(1);
  if (rows.length === 0) return null;
  return normaliseTicket(rows[0]!);
}

export interface UpdateTicketInput {
  description?: string;
  summary?: string | null;
  url?: string | null;
  status?: string;
  stage?: string | null;
  worktreePath?: string | null;
  branchName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  prUrl?: string | null;
  prSummary?: string | null;
  prTitle?: string | null;
  prDescription?: string | null;
  needsHumanCategory?: string | null;
  needsHumanReason?: string | null;
  quickWinChoices?: string | null;
  quickWinAttempts?: number;
  issueType?: string | null;
  priority?: string | null;
  sprint?: string | null;
  storyPoints?: number | null;
  team?: string | null;
  assignee?: string | null;
  parentKey?: string | null;
  attachments?: string | null;
  feedback?: string | null;
  type?: string | null;
}

export async function updateTicket(
  db: Database,
  key: string,
  input: UpdateTicketInput,
): Promise<Ticket | null> {
  const existing = await db.select({ key: tickets.key }).from(tickets).where(eq(tickets.key, key)).limit(1);
  if (existing.length === 0) return null;

  const now = new Date().toISOString();
  const sets: Record<string, unknown> = { updatedAt: now };

  if (input.description !== undefined) sets.description = input.description;
  if (input.summary !== undefined) sets.summary = input.summary;
  if (input.url !== undefined) sets.url = input.url;
  if (input.status !== undefined) sets.status = input.status;
  if (input.stage !== undefined) sets.stage = input.stage;
  if (input.worktreePath !== undefined) sets.worktreePath = input.worktreePath;
  if (input.branchName !== undefined) sets.branchName = input.branchName;
  if (input.startedAt !== undefined) sets.startedAt = input.startedAt;
  if (input.finishedAt !== undefined) sets.finishedAt = input.finishedAt;
  if (input.prUrl !== undefined) sets.prUrl = input.prUrl;
  if (input.prSummary !== undefined) sets.prSummary = input.prSummary;
  if (input.prTitle !== undefined) sets.prTitle = input.prTitle;
  if (input.prDescription !== undefined) sets.prDescription = input.prDescription;
  if (input.needsHumanCategory !== undefined) sets.needsHumanCategory = input.needsHumanCategory;
  if (input.needsHumanReason !== undefined) sets.needsHumanReason = input.needsHumanReason;
  if (input.quickWinChoices !== undefined) sets.quickWinChoices = input.quickWinChoices;
  if (input.quickWinAttempts !== undefined) sets.quickWinAttempts = input.quickWinAttempts;
  if (input.issueType !== undefined) sets.issueType = input.issueType;
  if (input.priority !== undefined) sets.priority = input.priority;
  if (input.sprint !== undefined) sets.sprint = input.sprint;
  if (input.storyPoints !== undefined) sets.storyPoints = input.storyPoints;
  if (input.team !== undefined) sets.team = input.team;
  if (input.assignee !== undefined) sets.assignee = input.assignee;
  if (input.parentKey !== undefined) sets.parentKey = input.parentKey;
  if (input.attachments !== undefined) sets.attachments = input.attachments;
  if (input.feedback !== undefined) sets.feedback = input.feedback;
  if (input.type !== undefined) sets.type = input.type;

  await db.update(tickets).set(sets).where(eq(tickets.key, key));
  return getTicket(db, key);
}

export async function deleteTicket(db: Database, key: string): Promise<boolean> {
  const result = await db.delete(tickets).where(eq(tickets.key, key));
  return (result.rowCount ?? 0) > 0;
}
