import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodeInvoker } from "./claude-code.js";

async function main(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-manual-check-"));
  writeFileSync(join(scratchDir, "greeting.txt"), "the secret word is banana\n");

  const invoker = new ClaudeCodeInvoker();
  console.log(`Running against real claude CLI in ${scratchDir}...`);

  const result = await invoker.run({
    prompt: "Read greeting.txt and tell me exactly what the secret word is, nothing else.",
    cwd: scratchDir,
    timeoutMs: 60000,
    onOutputLine: (line) => console.log(`[transcript] ${line}`),
  });

  console.log("\n=== RESULT ===");
  console.log(`outcome: ${result.outcome}`);
  console.log(`finalText: ${result.finalText}`);
  console.log(`exitCode: ${result.exitCode}`);
  console.log(`durationSec: ${result.durationSec}`);

  if (result.outcome !== "ok") {
    console.error("MANUAL CHECK FAILED: outcome was not ok");
    process.exit(1);
  }
  if (!result.finalText.toLowerCase().includes("banana")) {
    console.error("MANUAL CHECK FAILED: finalText did not mention the secret word");
    process.exit(1);
  }
  console.log("\nMANUAL CHECK PASSED");
}

void main();
