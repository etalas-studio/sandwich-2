import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const REGISTRY_PATH = join(ROOT, "registry", "roadmap.json");
export const ROADMAP_PATH = join(ROOT, "ROADMAP.md");

export const STATUSES = ["planned", "in_progress", "blocked"];

export function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`Registry not found at ${REGISTRY_PATH}`);
  }
  const reg = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  validateRegistry(reg);
  return reg;
}

export function saveRegistry(registry) {
  validateRegistry(registry);
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf8");
}

/**
 * Fail loudly on the mistakes that break collaboration: duplicate ids, unknown
 * status, missing required fields. This is a forward-looking roadmap — there is
 * deliberately no "done" status; finished work is deleted from the registry.
 */
export function validateRegistry(reg) {
  const errors = [];

  if (!reg || typeof reg !== "object") throw new Error("Registry must be a JSON object");
  if (!Array.isArray(reg.milestones)) throw new Error("Registry.milestones must be an array");

  const seenMilestoneIds = new Set();
  const seenIssueIds = new Set();

  for (const ms of reg.milestones) {
    if (!ms.id) errors.push(`Milestone missing "id": ${JSON.stringify(ms.name ?? ms)}`);
    if (!ms.name) errors.push(`Milestone "${ms.id}" missing "name"`);
    if (!ms.goal) errors.push(`Milestone "${ms.id}" missing "goal"`);
    if (seenMilestoneIds.has(ms.id)) errors.push(`Duplicate milestone id "${ms.id}"`);
    seenMilestoneIds.add(ms.id);

    if (!Array.isArray(ms.issues)) {
      errors.push(`Milestone "${ms.id}" missing "issues" array`);
      continue;
    }

    for (const issue of ms.issues) {
      if (!issue.id) errors.push(`Issue in "${ms.id}" missing "id": ${JSON.stringify(issue.title ?? issue)}`);
      if (seenIssueIds.has(issue.id)) errors.push(`Duplicate issue id "${issue.id}"`);
      seenIssueIds.add(issue.id);
      if (!issue.title) errors.push(`Issue "${issue.id}" missing "title"`);
      if (!issue.what) errors.push(`Issue "${issue.id}" missing "what"`);
      if (!STATUSES.includes(issue.status)) {
        errors.push(`Issue "${issue.id}" has invalid status "${issue.status}" (expected one of ${STATUSES.join(", ")})`);
      }
      if (issue.acceptance != null && !Array.isArray(issue.acceptance)) {
        errors.push(`Issue "${issue.id}" — "acceptance" must be an array of strings`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Registry validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}

/** Next free id within a milestone, e.g. "M2-03". */
export function nextIssueId(milestone) {
  const prefix = milestone.id.toUpperCase();
  let max = 0;
  for (const issue of milestone.issues ?? []) {
    const m = /^(.+)-(\d+)$/.exec(issue.id ?? "");
    if (m && m[1].toUpperCase() === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}
