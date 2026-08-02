import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

async function main(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-pty-manual-check-"));
  writeFileSync(join(scratchDir, "greeting.txt"), "the secret word is mango\n");

  const invoker = new ClaudeCodePtyInvoker();
  console.log(`Running against real claude CLI (PTY mode) in ${scratchDir}...`);

  const result = await invoker.run({
    prompt: "Read greeting.txt and tell me exactly what the secret word is, nothing else.",
    cwd: scratchDir,
    timeoutMs: 120000,
  });

  console.log("\n=== RESULT ===");
  console.log(`outcome: ${result.outcome}`);
  console.log(`finalText (first 500 chars): ${result.finalText.slice(0, 500)}`);
  console.log(`exitCode: ${result.exitCode}`);
  console.log(`durationSec: ${result.durationSec}`);

  if (result.outcome !== "ok") {
    console.error("MANUAL CHECK FAILED: outcome was not ok");
    process.exit(1);
  }
  if (!result.finalText.toLowerCase().includes("mango")) {
    console.error("MANUAL CHECK FAILED: finalText did not mention the secret word");
    process.exit(1);
  }
  console.log("\nMANUAL CHECK PASSED");
}

void main();
