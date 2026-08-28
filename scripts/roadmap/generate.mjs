import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRegistry, ROADMAP_PATH } from "./registry.mjs";

const STATUS_LABEL = {
  planned: "⚪ Planned",
  in_progress: "🔵 In progress",
  blocked: "🔴 Blocked",
};

function statusRank(status) {
  return { in_progress: 0, blocked: 1, planned: 2 }[status] ?? 3;
}

export function renderRoadmap(reg) {
  const today = new Date().toISOString().slice(0, 10);
  const L = [];

  L.push(`# ${reg.project ?? "Roadmap"} — Roadmap`);
  L.push("");
  if (reg.description) {
    L.push(reg.description);
    L.push("");
  }
  L.push(
    "> **Generated file — do not edit by hand.** Source of truth: [`registry/roadmap.json`](./registry/roadmap.json). " +
      "Regenerate with `npm run roadmap:generate`.",
  );
  L.push("");
  L.push(
    "This roadmap is **forward-looking**: it lists only work we intend to do. " +
      "When an item ships, it is deleted from the registry — git history keeps the record.",
  );
  L.push("");
  L.push("**Status:** ⚪ Planned · 🔵 In progress · 🔴 Blocked");
  L.push("");

  // Snapshot table -----------------------------------------------------------
  L.push("## At a glance");
  L.push("");
  L.push("| ID | Item | Milestone | Status | Owner |");
  L.push("| --- | --- | --- | --- | --- |");
  for (const ms of reg.milestones) {
    for (const issue of [...ms.issues].sort((a, b) => statusRank(a.status) - statusRank(b.status))) {
      L.push(
        `| ${issue.id} | ${issue.title} | ${ms.name} | ${STATUS_LABEL[issue.status] ?? issue.status} | ${issue.owner || "—"} |`,
      );
    }
  }
  L.push("");
  L.push("---");
  L.push("");

  // Full detail — each issue is its own ticket ------------------------------
  for (const ms of reg.milestones) {
    L.push(`## ${ms.id.toUpperCase()} — ${ms.name}`);
    L.push("");
    L.push(`**Goal:** ${ms.goal}`);
    L.push("");
    if (!ms.issues.length) {
      L.push("_No items yet._");
      L.push("");
      continue;
    }
    for (const issue of [...ms.issues].sort((a, b) => statusRank(a.status) - statusRank(b.status))) {
      L.push(`### ${issue.id} · ${issue.title}`);
      L.push("");
      L.push(`**Status:** ${STATUS_LABEL[issue.status] ?? issue.status}  |  **Owner:** ${issue.owner || "unassigned"}`);
      L.push("");
      L.push(issue.what);
      L.push("");
      if (issue.why) {
        L.push(`**Why:** ${issue.why}`);
        L.push("");
      }
      if (issue.acceptance?.length) {
        L.push("**Acceptance criteria:**");
        for (const a of issue.acceptance) L.push(`- [ ] ${a}`);
        L.push("");
      }
      if (issue.notes) {
        L.push(`**Notes:** ${issue.notes}`);
        L.push("");
      }
      if (issue.blocked_by) {
        L.push(`**Blocked by:** ${issue.blocked_by}`);
        L.push("");
      }
    }
  }

  L.push("---");
  L.push("");
  L.push("## How to update");
  L.push("");
  L.push("1. Edit [`registry/roadmap.json`](./registry/roadmap.json) — **never edit this file directly.**");
  L.push("2. Run `npm run roadmap:generate` to rebuild `ROADMAP.md`.");
  L.push("3. Commit `registry/roadmap.json` and `ROADMAP.md` together.");
  L.push("");
  L.push("**Adding an item:** give it an id `<milestone>-<n>` (e.g. `M2-04`), a `title`, a plain-language `what`, and `status: \"planned\"`.");
  L.push("");
  L.push("**Finishing an item:** delete its entry from the registry and regenerate. This roadmap never shows completed work.");
  L.push("");
  L.push(`_Last generated: ${today}_`);
  L.push("");
  return L.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reg = loadRegistry();
  const next = renderRoadmap(reg);
  const check = process.argv.includes("--check");

  if (check) {
    let current = "";
    try {
      current = readFileSync(ROADMAP_PATH, "utf8");
    } catch {
      /* missing file => out of date */
    }
    // Ignore the "Last generated" date line when comparing.
    const strip = (s) => s.replace(/^_Last generated: .*$/m, "");
    if (strip(current) !== strip(next)) {
      console.error("ROADMAP.md is out of date. Run `npm run roadmap:generate` and commit the result.");
      process.exit(1);
    }
    console.log("ROADMAP.md is in sync with the registry.");
  } else {
    writeFileSync(ROADMAP_PATH, next, "utf8");
    const count = reg.milestones.reduce((n, ms) => n + ms.issues.length, 0);
    console.log(`ROADMAP.md regenerated (${reg.milestones.length} milestones, ${count} open items).`);
  }
}
