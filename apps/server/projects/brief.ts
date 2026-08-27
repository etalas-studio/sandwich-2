import { writeFile } from "node:fs/promises";
import { resolveInsideProject, BRIEF_FILE } from "./workspace.js";

/**
 * BRIEF.md — the only user-originated context that lands on disk. Every engine
 * reads it for grounding; raw chat logs and raw uploads never enter the project
 * directory (they'd be picked up as noise via `ls` / `read`).
 *
 * `buildBriefMarkdown` is PURE and DETERMINISTIC: identical input must produce
 * byte-identical output. No timestamps, no ordering nondeterminism — otherwise
 * every run dirties BRIEF.md and forces a commit, breaking the empty-diff rule.
 */

export type BriefRole = "user" | "assistant" | "system";

export interface BriefTurn {
  role: BriefRole;
  content: string;
}

export interface BriefAttachment {
  filename: string;
  extractedText: string | null;
  extractStatus: string;
}

export interface BriefInput {
  title: string;
  turns: BriefTurn[];
  attachments: BriefAttachment[];
}

/** Per-attachment cap; longer extracted text is truncated with a marker. */
export const ATTACHMENT_CHAR_CAP = 2_000;
/** Total attachment-section cap across all files. */
export const ATTACHMENT_TOTAL_CAP = 20_000;

function collapse(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function foldUserTurns(turns: BriefTurn[]): string[] {
  const parts: string[] = [];
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const text = collapse(turn.content);
    if (!text) continue;
    if (parts[parts.length - 1] === text) continue;
    parts.push(text);
  }
  return parts;
}

/** Assistant question → next user answer, in order. */
function pairClarifications(turns: BriefTurn[]): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role !== "assistant" || !t.content.includes("?")) continue;
    const next = turns[i + 1];
    if (!next || next.role !== "user") continue;
    const question = collapse(t.content);
    const answer = collapse(next.content);
    if (question && answer) pairs.push({ question, answer });
  }
  return pairs;
}

function truncate(text: string, cap: number): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false };
  return { text: text.slice(0, cap).trimEnd(), truncated: true };
}

export function buildBriefMarkdown(input: BriefInput): string {
  const lines: string[] = [];
  const title = collapse(input.title) || "Untitled project";
  lines.push(`# ${title}`, "");

  const request = foldUserTurns(input.turns);
  lines.push("## Request", "");
  lines.push(request.length ? request.join("\n\n") : "_No brief provided yet._", "");

  const clarifications = pairClarifications(input.turns);
  if (clarifications.length) {
    lines.push("## Clarifications", "");
    for (const { question, answer } of clarifications) {
      lines.push(`**Q:** ${question}`, "", `**A:** ${answer}`, "");
    }
  }

  const withText = input.attachments.filter(
    (a) => a.extractStatus === "done" && a.extractedText && a.extractedText.trim(),
  );
  const pending = input.attachments.filter((a) => a.extractStatus !== "done");
  if (withText.length || pending.length) {
    lines.push("## Attachments", "");
    let budget = ATTACHMENT_TOTAL_CAP;
    for (const a of withText) {
      const perFile = truncate(collapse(a.extractedText!), Math.min(ATTACHMENT_CHAR_CAP, budget));
      budget -= perFile.text.length;
      lines.push(`### ${collapse(a.filename)}`, "");
      lines.push("```", perFile.text, "```");
      if (perFile.truncated || budget <= 0) {
        lines.push("", "_(extract truncated — full text kept in object storage)_");
      }
      lines.push("");
      if (budget <= 0) break;
    }
    for (const a of pending) {
      lines.push(`### ${collapse(a.filename)}`, "", `_(extraction ${a.extractStatus})_`, "");
    }
  }

  // Exactly one trailing newline — stable across runs.
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

/** Writes BRIEF.md at the project root. Returns the absolute path. */
export async function writeBrief(projectDir: string, markdown: string): Promise<string> {
  const path = resolveInsideProject(projectDir, BRIEF_FILE);
  await writeFile(path, markdown, "utf8");
  return path;
}
