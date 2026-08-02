import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodeInvoker } from "./claude-code.js";

const ALLOW_ENV = "ALLOW_LIVE_CLAUDE_CHECK";

async function main(): Promise<void> {
  if (process.env[ALLOW_ENV] !== "1") {
    console.error(
      `Refusing to run: this hits the real Claude Code CLI and spends real tokens.\n` +
        `Set ${ALLOW_ENV}=1 to run it deliberately. Do not run this without the human's explicit approval (see CLAUDE.md).`,
    );
    process.exit(1);
  }

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
