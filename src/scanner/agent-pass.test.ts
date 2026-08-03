import { strict as assert } from "node:assert";
import { runAgentPass } from "./agent-pass.js";
import type { MechanicalResult } from "./mechanical.js";

function makeMechanicalResult(): MechanicalResult {
  return {
    projectName: "test-app",
    description: "A test application",
    techStack: "Node.js, TypeScript",
    testCommand: "npm test",
    areaSignals: [
      { area: "src", files: 4, testToCodeRatio: 0.5, churnScore: 1.0, note: "" },
    ],
  };
}

function agentJson(desc: string | null, blocklist: Array<{ pattern: string; reason: string }>): string {
  return JSON.stringify({ description: desc, blocklist });
}

// ── Valid response with description + blocklist ──

async function testParsesDescriptionAndBlocklist(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: agentJson("A pipeline orchestrator for AI agents.", [
          { pattern: "src/secrets/**", reason: "API keys" },
        ]),
      };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.description, "A pipeline orchestrator for AI agents.");
  assert.equal(result.blocklistProposals.length, 1);
  assert.equal(result.blocklistProposals[0]!.pattern, "src/secrets/**");
  console.log("PASS: testParsesDescriptionAndBlocklist");
}

// ── Null description ──

async function testHandlesNullDescription(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: agentJson(null, []),
      };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.description, null);
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesNullDescription");
}

// ── Malformed output ──

async function testHandlesMalformedOutput(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: "Just some prose, no JSON here.",
      };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.description, null);
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesMalformedOutput");
}

// ── Old format fallback (just blocklist array) ──

async function testFallsBackToOldBlocklistFormat(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: JSON.stringify([
          { pattern: "*.pem", reason: "Private keys" },
        ]),
      };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.description, null);
  assert.equal(result.blocklistProposals.length, 1);
  assert.equal(result.blocklistProposals[0]!.pattern, "*.pem");
  console.log("PASS: testFallsBackToOldBlocklistFormat");
}

// ── Engine timeout ──

async function testReportsEngineTimeout(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return { outcome: "timeout" as const, finalText: "" };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "timeout");
  console.log("PASS: testReportsEngineTimeout");
}

// ── Process error ──

async function testReportsEngineProcessError(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return { outcome: "process_error" as const, finalText: "" };
    },
  };

  const controller = new AbortController();
  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "process_error");
  console.log("PASS: testReportsEngineProcessError");
}

// ── Abort signal ──

async function testAbortsWhenSignalled(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const controller = new AbortController();
  controller.abort();

  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return { outcome: "ok" as const, finalText: "{}" };
    },
  };

  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "aborted");
  assert.equal(result.description, null);
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testAbortsWhenSignalled");
}

async function main(): Promise<void> {
  await testParsesDescriptionAndBlocklist();
  await testHandlesNullDescription();
  await testHandlesMalformedOutput();
  await testFallsBackToOldBlocklistFormat();
  await testReportsEngineTimeout();
  await testReportsEngineProcessError();
  await testAbortsWhenSignalled();
}

main();
