import { strict as assert } from "node:assert";
import { buildScanAssessmentPrompt, parseScanAssessment } from "./scan-prompt.js";

function testPromptAsksForAreasAndOmitsPerAreaSignalsInput(): void {
  const prompt = buildScanAssessmentPrompt({ techStack: "Node.js, TypeScript", testCommand: "npm test" });

  assert.match(prompt, /"areas"/);
  assert.match(prompt, /logical "areas"/i);
  // The old mechanical per-area table used to be fed back into the prompt —
  // it can't be anymore, since the agent's own response is now what
  // determines what an "area" even is.
  assert.doesNotMatch(prompt, /test-to-code ratio/i);
  console.log("PASS: testPromptAsksForAreasAndOmitsPerAreaSignalsInput");
}

function testParsesValidAreasArray(): void {
  const text = JSON.stringify({
    codebaseSummary: "A CLI tool.",
    agenticFlowSummary: "Has CLAUDE.md and CI.",
    blocklist: [],
    areas: [
      { name: "orders", paths: ["src/domain/orders"] },
      { name: "billing", paths: ["src/domain/billing", "src/api/billing-controller.ts"] },
    ],
  });

  const parsed = parseScanAssessment(text);
  assert.ok(parsed);
  assert.equal(parsed!.areas.length, 2);
  assert.deepEqual(parsed!.areas[0], { name: "orders", paths: ["src/domain/orders"] });
  console.log("PASS: testParsesValidAreasArray");
}

function testDropsAreasMissingNameOrPaths(): void {
  const text = JSON.stringify({
    codebaseSummary: null,
    agenticFlowSummary: null,
    blocklist: [],
    areas: [
      { name: "no-paths" },
      { paths: ["src/x"] },
      { name: "", paths: ["src/y"] },
      { name: "valid", paths: ["src/z"] },
    ],
  });

  const parsed = parseScanAssessment(text);
  assert.ok(parsed);
  assert.deepEqual(parsed!.areas, [{ name: "valid", paths: ["src/z"] }]);
  console.log("PASS: testDropsAreasMissingNameOrPaths");
}

function testMissingAreasFieldParsesAsEmptyArrayNotFailure(): void {
  const text = JSON.stringify({ codebaseSummary: "x", agenticFlowSummary: "y", blocklist: [] });

  const parsed = parseScanAssessment(text);
  assert.ok(parsed);
  assert.deepEqual(parsed!.areas, []);
  console.log("PASS: testMissingAreasFieldParsesAsEmptyArrayNotFailure");
}

function testNonArrayAreasFieldParsesAsEmptyArray(): void {
  const text = JSON.stringify({ codebaseSummary: "x", agenticFlowSummary: "y", blocklist: [], areas: "not-an-array" });

  const parsed = parseScanAssessment(text);
  assert.ok(parsed);
  assert.deepEqual(parsed!.areas, []);
  console.log("PASS: testNonArrayAreasFieldParsesAsEmptyArray");
}

function main(): void {
  testPromptAsksForAreasAndOmitsPerAreaSignalsInput();
  testParsesValidAreasArray();
  testDropsAreasMissingNameOrPaths();
  testMissingAreasFieldParsesAsEmptyArrayNotFailure();
  testNonArrayAreasFieldParsesAsEmptyArray();
}

main();
