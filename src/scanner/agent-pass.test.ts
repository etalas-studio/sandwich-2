import { strict as assert } from "node:assert";
import { runAgentPass } from "./agent-pass.js";
import type { MechanicalResult } from "./mechanical.js";

function makeMechanicalResult(): MechanicalResult {
  return {
    projectName: "test-app",
    techStack: "Node.js, TypeScript",
    testCommand: "npm test",
    areaSignals: [
      { area: "src", files: 4, testToCodeRatio: 0.5, churnScore: 1.0, note: "" },
    ],
  };
}

// ── Valid JSON output ──

async function testParsesValidBlocklistJson(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: 'Some prose\n[{"pattern":"src/secrets/**","reason":"API keys"}]\nMore text',
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
  assert.equal(result.blocklistProposals.length, 1);
  assert.equal(result.blocklistProposals[0]!.pattern, "src/secrets/**");
  assert.equal(result.blocklistProposals[0]!.reason, "API keys");
  console.log("PASS: testParsesValidBlocklistJson");
}

// ── Malformed output ──

async function testHandlesMalformedOutput(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: "Just some prose, no JSON array here.",
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
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesMalformedOutput");
}

// ── Empty array ──

async function testHandlesEmptyBlocklistArray(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: "Nothing risky found.\n[]",
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
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesEmptyBlocklistArray");
}

// ── Multiple entries ──

async function testParsesMultipleBlocklistEntries(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: JSON.stringify([
          { pattern: "src/secrets/**", reason: "API keys" },
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
  assert.equal(result.blocklistProposals.length, 2);
  console.log("PASS: testParsesMultipleBlocklistEntries");
}

// ── Invalid JSON (not an array) ──

async function testHandlesNonArrayJson(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: '{"not": "an array"}',
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
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesNonArrayJson");
}

// ── Engine timeout ──

async function testReportsEngineTimeout(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "timeout" as const,
        finalText: "",
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

  assert.equal(result.outcome, "timeout");
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testReportsEngineTimeout");
}

// ── Engine process error ──

async function testReportsEngineProcessError(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "process_error" as const,
        finalText: "",
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

  assert.equal(result.outcome, "process_error");
  console.log("PASS: testReportsEngineProcessError");
}

// ── Abort signal ──

async function testAbortsWhenSignalled(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const controller = new AbortController();

  // Abort before the invoker runs
  controller.abort();

  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      // Should not be called if we catch the signal first
      return { outcome: "ok" as const, finalText: "[]" };
    },
  };

  const result = await runAgentPass({
    repoPath: "/fake/repo",
    mechanicalResult: mechanical,
    signal: controller.signal,
    invoker,
  });

  assert.equal(result.outcome, "aborted");
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testAbortsWhenSignalled");
}

async function main(): Promise<void> {
  await testParsesValidBlocklistJson();
  await testHandlesMalformedOutput();
  await testHandlesEmptyBlocklistArray();
  await testParsesMultipleBlocklistEntries();
  await testHandlesNonArrayJson();
  await testReportsEngineTimeout();
  await testReportsEngineProcessError();
  await testAbortsWhenSignalled();
}

main();
