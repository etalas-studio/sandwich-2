// src/engine/claude-code-pty.test.ts
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

/**
 * A fake interactive "claude" binary: a small script that prints a fixed
 * response, then waits for input on stdin (simulating a real Claude Code
 * session sitting at its prompt after answering), and exits when it reads
 * "/exit" — mirroring the real dialog-then-answer-then-wait-for-/exit shape
 * the PoC observed. This keeps the test fast and network-free while still
 * exercising the real PTY-write/read code path.
 */
function writeFakeInteractiveBinary(scratchDir: string): string {
  const fakeBinPath = join(scratchDir, "fake-claude-pty.sh");
  writeFileSync(
    fakeBinPath,
    [
      "#!/bin/sh",
      'echo "the answer is 42"',
      "while true; do",
      "  read -r line",
      '  if [ "$line" = "/exit" ]; then exit 0; fi',
      "done",
    ].join("\n"),
  );
  chmodSync(fakeBinPath, 0o755);
  return fakeBinPath;
}

async function testExtractsAnswerAndForcesCleanExit(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-invoker-test-"));
  const fakeBinPath = writeFakeInteractiveBinary(scratchDir);

  const invoker = new ClaudeCodePtyInvoker({ bin: fakeBinPath, exitAfterMs: 500 });
  const result = await invoker.run({
    prompt: "what is the answer",
    cwd: scratchDir,
    timeoutMs: 5000,
  });

  assert.equal(result.outcome, "ok");
  assert.match(result.finalText, /the answer is 42/);
  assert.equal(result.exitCode, 0);
  console.log("PASS: testExtractsAnswerAndForcesCleanExit");
}

async function testReportsTimeoutWhenExitNeverHappens(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude-hang.sh");
  // This fake binary ignores "/exit" entirely — it never reads stdin at all,
  // so the invoker's /exit-then-safety-timeout path must be what ends the run.
  writeFileSync(fakeBinPath, "#!/bin/sh\nsleep 10\n");
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodePtyInvoker({ bin: fakeBinPath, exitAfterMs: 100 });
  const result = await invoker.run({
    prompt: "this will hang",
    cwd: scratchDir,
    timeoutMs: 300,
  });

  assert.equal(result.outcome, "timeout");
  console.log("PASS: testReportsTimeoutWhenExitNeverHappens");
}

async function main(): Promise<void> {
  await testExtractsAnswerAndForcesCleanExit();
  await testReportsTimeoutWhenExitNeverHappens();
}

void main();
