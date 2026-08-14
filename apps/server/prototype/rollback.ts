export type RollbackIntent = "previous" | "latest";

const LATEST = [
  "versi latest",
  "versi terbaru",
  "balik ke latest",
  "kembali ke versi terbaru",
  "kembali ke latest",
  "latest",
];

const PREVIOUS = [
  "versi sebelumnya",
  "versi sebelum",
  "balikin versi",
  "balikan versi",
  "kembalikan versi",
  "rollback",
  "undo",
];

export function parseRollbackIntent(instruction: string): RollbackIntent | null {
  const s = instruction.toLowerCase();
  if (LATEST.some((p) => s.includes(p))) return "latest";
  if (PREVIOUS.some((p) => s.includes(p))) return "previous";
  return null;
}
