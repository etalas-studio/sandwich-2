// src/engine/claude-code.test.ts
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodeInvoker } from "./claude-code.js";

async function testExtractsFinalTextFromResultLine(): Promise<void> {
  // A fake "claude" binary that emits one stream-json line shaped like a real
  // Claude Code `result` event, so this test never touches the network or a
  // real subscription.
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude.sh");
  writeFileSync(
    fakeBinPath,
    `#!/bin/sh\necho '{"type":"result","result":"the answer is 42"}'\n`,
  );
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodeInvoker({ bin: fakeBinPath });
  const result = await invoker.run({
    prompt: "what is the answer",
    cwd: scratchDir,
    timeoutMs: 5000,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.finalText, "the answer is 42");
  assert.equal(result.exitCode, 0);
  console.log("PASS: testExtractsFinalTextFromResultLine");
}

async function testReportsTimeoutOutcome(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude-slow.sh");
  writeFileSync(fakeBinPath, `#!/bin/sh\nsleep 5\n`);
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodeInvoker({ bin: fakeBinPath });
  const result = await invoker.run({
    prompt: "this will hang",
    cwd: scratchDir,
    timeoutMs: 200,
  });

  assert.equal(result.outcome, "timeout");
  console.log("PASS: testReportsTimeoutOutcome");
}

async function main(): Promise<void> {
  await testExtractsFinalTextFromResultLine();
  await testReportsTimeoutOutcome();
}

void main();
