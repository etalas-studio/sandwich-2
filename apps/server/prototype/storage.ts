import { eq, and } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import { prototypes, prototypeFiles } from "./schema.js";
import type { Database } from "../db/connection.js";

export interface Prototype {
  id: string;
  userId: string;
  shareId: string;
  name: string;
  brief: string;
  logoData: string | null;
  palette: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrototypeFile {
  id: number;
  prototypeId: string;
  path: string;
  content: string;
  createdAt: Date;
}

export interface CreatePrototypeInput {
  userId: string;
  name: string;
  brief: string;
  logoData?: string | null;
  palette?: string | null;
}

export async function createPrototype(db: Database, input: CreatePrototypeInput): Promise<Prototype> {
  const id = randomUUID();
  const shareId = randomBytes(6).toString("hex");
  const now = new Date();
  await db.insert(prototypes).values({
    id,
    userId: input.userId,
    shareId,
    name: input.name,
    brief: input.brief,
    logoData: input.logoData ?? null,
    palette: input.palette ?? null,
    status: "generating",
    createdAt: now,
    updatedAt: now,
  });
  return (await getPrototype(db, id))!;
}

export async function getPrototype(db: Database, id: string): Promise<Prototype | null> {
  const rows = await db.select().from(prototypes).where(eq(prototypes.id, id)).limit(1);
  return rows.length > 0 ? rows[0]! : null;
}

export async function getPrototypeByShareId(db: Database, shareId: string): Promise<Prototype | null> {
  const rows = await db.select().from(prototypes).where(eq(prototypes.shareId, shareId)).limit(1);
  return rows.length > 0 ? rows[0]! : null;
}

export async function listPrototypes(db: Database, userId: string): Promise<Prototype[]> {
  return db.select().from(prototypes).where(eq(prototypes.userId, userId));
}

export async function updatePrototypeStatus(db: Database, id: string, status: string): Promise<void> {
  const now = new Date();
  await db.update(prototypes).set({ status, updatedAt: now }).where(eq(prototypes.id, id));
}

export async function updatePrototypeBrief(db: Database, id: string, brief: string): Promise<void> {
  const now = new Date();
  await db.update(prototypes).set({ brief, status: "generating", updatedAt: now }).where(eq(prototypes.id, id));
}

export async function savePrototypeFile(db: Database, prototypeId: string, path: string, content: string): Promise<void> {
  const now = new Date();
  await db.insert(prototypeFiles).values({
    prototypeId,
    path,
    content,
    createdAt: now,
  }).onConflictDoUpdate({
    target: [prototypeFiles.prototypeId, prototypeFiles.path],
    set: { content, createdAt: now },
  });
}

export async function getPrototypeFiles(db: Database, prototypeId: string): Promise<PrototypeFile[]> {
  return db.select().from(prototypeFiles).where(eq(prototypeFiles.prototypeId, prototypeId));
}

export async function getPrototypeFile(db: Database, prototypeId: string, path: string): Promise<PrototypeFile | null> {
  const rows = await db.select().from(prototypeFiles)
    .where(and(eq(prototypeFiles.prototypeId, prototypeId), eq(prototypeFiles.path, path)))
    .limit(1);
  return rows.length > 0 ? rows[0]! : null;
}
