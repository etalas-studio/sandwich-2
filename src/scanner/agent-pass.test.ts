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
      { area: "src", files: 4, testFileCount: 2, testToCodeRatio: 0.5, churnScore: 1.0, note: "" },
    ],
  };
}

function fullResponse(opts: {
  description?: string | null;
  areas?: Array<{ name: string; paths: string[]; note?: string }>;
  blocklist?: Array<{ pattern: string; reason: string }>;
  recommendations?: Array<{ title: string; description: string }>;
}): string {
  return JSON.stringify({
    description: opts.description ?? null,
    areas: opts.areas ?? [],
    blocklist: opts.blocklist ?? [],
    recommendations: opts.recommendations ?? [],
  });
}

// ── Full format: description + areas + blocklist ──

async function testParsesFullResponse(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: fullResponse({
          description: "A pipeline orchestrator.",
          areas: [
            { name: "Auth", paths: ["src/auth/"], note: "Handles sessions" },
            { name: "DB Layer", paths: ["src/db/"], note: "Schema migrations" },
          ],
          blocklist: [{ pattern: "src/secrets/**", reason: "API keys" }],
          recommendations: [
            { title: "Add CLAUDE.md", description: "No agent instructions found." },
          ],
        }),
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
  assert.equal(result.description, "A pipeline orchestrator.");
  assert.equal(result.areas.length, 2);
  assert.equal(result.areas[0]!.name, "Auth");
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]!.title, "Add CLAUDE.md");
  assert.equal(result.recommendations[0]!.description, "No agent instructions found.");
  assert.equal(result.blocklistProposals.length, 1);
  console.log("PASS: testParsesFullResponse");
}

// ── Empty areas ──

async function testHandlesEmptyAreas(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: fullResponse({ description: "desc", areas: [], blocklist: [] }),
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
  assert.equal(result.areas.length, 0);
  console.log("PASS: testHandlesEmptyAreas");
}

// ── Malformed output ──

async function testHandlesMalformedOutput(): Promise<void> {
  const mechanical = makeMechanicalResult();
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return { outcome: "ok" as const, finalText: "Just prose, no JSON." };
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
  assert.equal(result.areas.length, 0);
  assert.equal(result.blocklistProposals.length, 0);
  console.log("PASS: testHandlesMalformedOutput");
}

// ── Old blocklist-only format (no areas) ──

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
  assert.equal(result.areas.length, 0);
  assert.equal(result.blocklistProposals.length, 1);
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

// ── Abort ──

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
  assert.equal(result.areas.length, 0);
  console.log("PASS: testAbortsWhenSignalled");
}

async function main(): Promise<void> {
  await testParsesFullResponse();
  await testHandlesEmptyAreas();
  await testHandlesMalformedOutput();
  await testFallsBackToOldBlocklistFormat();
  await testReportsEngineTimeout();
  await testAbortsWhenSignalled();
}

main();
