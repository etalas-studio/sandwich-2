import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type ReferenceDocType = "prd" | "quotation";

export interface ReferenceMeta {
  slug: string;
  title: string;
  language: string;
  industry: string;
  tags: string[];
  description: string;
}

interface ReferenceIndex {
  version: number;
  references: ReferenceMeta[];
}

function referencesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "references"),
    join(here, "..", "..", "apps", "server", "notifications", "references"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

function loadIndex(type: ReferenceDocType): ReferenceMeta[] {
  const indexPath = join(referencesRoot(), type, "index.json");
  if (!existsSync(indexPath)) return [];
  const parsed = JSON.parse(readFileSync(indexPath, "utf-8")) as ReferenceIndex;
  return parsed.references;
}

function scoreReference(ref: ReferenceMeta, briefWords: Set<string>): number {
  const keywords = [ref.industry, ...ref.tags].flatMap((k) => k.split("-"));
  return keywords.reduce((score, word) => (briefWords.has(word.toLowerCase()) ? score + 1 : score), 0);
}

export function selectReference(type: ReferenceDocType, briefText: string): ReferenceMeta | null {
  const all = loadIndex(type);
  if (all.length === 0) return null;

  const briefWords = new Set(briefText.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean));
  let best = all[0]!;
  let bestScore = -1;
  for (const ref of all) {
    const score = scoreReference(ref, briefWords);
    if (score > bestScore) {
      bestScore = score;
      best = ref;
    }
  }
  return best;
}

function readReferenceContent(type: ReferenceDocType, slug: string): string {
  const path = join(referencesRoot(), type, `${slug}.md`);
  return readFileSync(path, "utf-8");
}

export function buildReferenceBlock(type: ReferenceDocType, briefText: string): string {
  const ref = selectReference(type, briefText);
  if (!ref) return "";

  const content = readReferenceContent(type, ref.slug);
  const label = type === "prd" ? "PRD" : "quotation";

  return [
    `## Reference example (${ref.title})`,
    ``,
    `The following is a REAL ${label} Etalas has delivered before, included ONLY as a style/structure reference:`,
    ``,
    content,
    ``,
    `--- END REFERENCE EXAMPLE ---`,
    ``,
    `IMPORTANT — how to use the reference above:`,
    `- Use it ONLY for tone, structure, section ordering, and level of detail.`,
    `- Do NOT copy client names, company names, prices, dates, or any figures from it.`,
    `- Do NOT invent facts that merely resemble the reference — every fact in your output must come from THIS conversation's brief, not from the reference example.`,
  ].join("\n");
}
