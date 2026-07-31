import { exec, fillArgs } from "./proc.js";
import type { CommandTemplate, PhaseResult } from "./types.js";

export interface RunPhaseOptions {
  template: CommandTemplate;
  prompt: string;
  allowedTools: string;
  cwd: string;
  timeoutMs: number;
}

/**
 * Jalankan satu tahap agent. Transcript ditampung baris per baris apa adanya —
 * karena Claude Code mengeluarkan stream-json satu objek per baris, tidak perlu
 * parsing output terminal yang rapuh.
 */
export async function runAgentPhase(
  options: RunPhaseOptions,
): Promise<PhaseResult> {
  const { template, prompt, allowedTools, cwd, timeoutMs } = options;

  const args = fillArgs(template.args, { prompt, allowedTools });
  const transcript: string[] = [];

  const result = await exec(template.bin, args, {
    cwd,
    timeoutMs,
    onStdoutLine: (line) => transcript.push(line),
  });

  return {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    transcript,
    stderr: result.stderr,
    durationSec: result.durationSec,
  };
}

/**
 * Ambil teks jawaban akhir dari transcript stream-json.
 *
 * Sengaja toleran: kalau formatnya bukan JSON per baris (misalnya engine diganti
 * dan formatnya beda), kembalikan gabungan baris mentah. Lebih baik dapat teks
 * kasar daripada gagal total dan kehilangan seluruh percobaan.
 */
export function extractFinalText(transcript: string[]): string {
  const texts: string[] = [];
  let sawJson = false;

  for (const line of transcript) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    sawJson = true;

    const text = pluckText(parsed);
    if (text) texts.push(text);
  }

  if (!sawJson) return transcript.join("\n").trim();
  return texts.join("\n").trim();
}

function pluckText(node: unknown): string | null {
  if (typeof node !== "object" || node === null) return null;
  const obj = node as Record<string, unknown>;

  // Bentuk { type: "result", result: "..." }
  if (obj["type"] === "result" && typeof obj["result"] === "string") {
    return obj["result"];
  }

  // Bentuk { type: "assistant", message: { content: [{ type: "text", text }] } }
  const message = obj["message"];
  if (typeof message === "object" && message !== null) {
    const content = (message as Record<string, unknown>)["content"];
    if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const item of content) {
        if (typeof item !== "object" || item === null) continue;
        const entry = item as Record<string, unknown>;
        if (entry["type"] === "text" && typeof entry["text"] === "string") {
          parts.push(entry["text"]);
        }
      }
      if (parts.length > 0) return parts.join("\n");
    }
  }

  return null;
}

/** Hitung tool call dari transcript, untuk melihat seberapa luas agent meraba. */
export function countToolCalls(transcript: string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const line of transcript) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const obj = parsed as Record<string, unknown>;
    const message = obj["message"];
    if (typeof message !== "object" || message === null) continue;

    const content = (message as Record<string, unknown>)["content"];
    if (!Array.isArray(content)) continue;

    for (const item of content) {
      if (typeof item !== "object" || item === null) continue;
      const entry = item as Record<string, unknown>;
      if (entry["type"] === "tool_use" && typeof entry["name"] === "string") {
        const name = entry["name"];
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
  }

  return counts;
}
