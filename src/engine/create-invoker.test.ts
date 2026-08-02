import { strict as assert } from "node:assert";
import { createEngineInvoker } from "./create-invoker.js";
import { ClaudeCodeInvoker } from "./claude-code.js";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

function testCreatesHeadlessInvokerByDefault(): void {
  const invoker = createEngineInvoker("headless");
  assert.ok(invoker instanceof ClaudeCodeInvoker);
  console.log("PASS: testCreatesHeadlessInvokerByDefault");
}

function testCreatesPtyInvokerWhenRequested(): void {
  const invoker = createEngineInvoker("pty");
  assert.ok(invoker instanceof ClaudeCodePtyInvoker);
  console.log("PASS: testCreatesPtyInvokerWhenRequested");
}

function main(): void {
  testCreatesHeadlessInvokerByDefault();
  testCreatesPtyInvokerWhenRequested();
}

main();
