import { eq, and } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import { prototypes, prototypeFiles, prototypeVersions } from "./schema.js";
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
  currentVersion: number;
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

export interface PrototypeVersion {
  id: number;
  prototypeId: string;
  version: number;
  files: Record<string, string>;
  createdAt: Date;
}

export async function snapshotVersion(
  db: Database,
  prototypeId: string,
  files: { path: string; content: string }[],
): Promise<number> {
  const rows = await db.select().from(prototypeVersions).where(eq(prototypeVersions.prototypeId, prototypeId));
  const maxVersion = rows.reduce((m, r) => Math.max(m, r.version), 0);
  const version = maxVersion + 1;
  const filesObj: Record<string, string> = {};
  for (const f of files) filesObj[f.path] = f.content;
  const now = new Date();
  await db.insert(prototypeVersions).values({
    prototypeId,
    version,
    files: filesObj,
    createdAt: now,
  });
  await db.update(prototypes).set({ currentVersion: version, updatedAt: now }).where(eq(prototypes.id, prototypeId));
  return version;
}

export async function getLatestVersion(db: Database, prototypeId: string): Promise<number | null> {
  const rows = await db.select().from(prototypeVersions).where(eq(prototypeVersions.prototypeId, prototypeId));
  if (rows.length === 0) return null;
  return rows.reduce((m, r) => Math.max(m, r.version), 0);
}

export async function getVersionFiles(
  db: Database,
  prototypeId: string,
  version: number,
): Promise<{ path: string; content: string }[] | null> {
  const rows = await db
    .select()
    .from(prototypeVersions)
    .where(and(eq(prototypeVersions.prototypeId, prototypeId), eq(prototypeVersions.version, version)))
    .limit(1);
  if (rows.length === 0) return null;
  const files = rows[0]!.files as Record<string, string>;
  return Object.entries(files).map(([path, content]) => ({ path, content: String(content) }));
}

export async function restoreVersion(db: Database, prototypeId: string, version: number): Promise<number> {
  const files = await getVersionFiles(db, prototypeId, version);
  if (!files) throw new Error(`prototype version ${version} not found`);
  // Remove files that exist in the current version but not in the target version
  // (otherwise rolling back leaves stale files that the target version didn't have).
  const targetPaths = new Set(files.map((f) => f.path));
  const current = await getPrototypeFiles(db, prototypeId);
  for (const f of current) {
    if (!targetPaths.has(f.path)) {
      await db
        .delete(prototypeFiles)
        .where(and(eq(prototypeFiles.prototypeId, prototypeId), eq(prototypeFiles.path, f.path)));
    }
  }
  for (const f of files) {
    await savePrototypeFile(db, prototypeId, f.path, f.content);
  }
  await db.update(prototypes).set({ currentVersion: version, updatedAt: new Date() }).where(eq(prototypes.id, prototypeId));
  return version;
}
