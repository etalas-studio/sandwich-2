import { strict as assert } from "node:assert";
import { buildCloneUrl, cloneRepo } from "./project-clone.js";

function testBuildCloneUrlEmbedsTokenForGithub(): void {
  const url = buildCloneUrl("github", "acme", "widgets", "test-token");
  assert.equal(url, "https://x-access-token:test-token@github.com/acme/widgets.git");
  console.log("PASS: testBuildCloneUrlEmbedsTokenForGithub");
}

function testBuildCloneUrlEmbedsTokenForBitbucket(): void {
  const url = buildCloneUrl("bitbucket", "acme", "widgets", "test-token");
  assert.equal(url, "https://x-token-auth:test-token@bitbucket.org/acme/widgets.git");
  console.log("PASS: testBuildCloneUrlEmbedsTokenForBitbucket");
}

async function testCloneRepoInvokesGitCloneWithUrlAndTargetDir(): Promise<void> {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  const fakeExec = async (cmd: string, args: string[]) => {
    calls.push({ cmd, args });
    return { ok: true as const };
  };

  const result = await cloneRepo(
    "https://x-access-token:tok@github.com/acme/widgets.git",
    "/tmp/repos/abc-123",
    fakeExec,
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.cmd, "git");
  assert.deepEqual(calls[0]!.args, [
    "clone",
    "https://x-access-token:tok@github.com/acme/widgets.git",
    "/tmp/repos/abc-123",
  ]);
  console.log("PASS: testCloneRepoInvokesGitCloneWithUrlAndTargetDir");
}

async function testCloneRepoReturnsFailureReasonWhenExecFails(): Promise<void> {
  const fakeExec = async () => ({ ok: false as const, error: "authentication failed" });

  const result = await cloneRepo(
    "https://x@github.com/acme/widgets.git",
    "/tmp/repos/abc-123",
    fakeExec,
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "authentication failed");
  console.log("PASS: testCloneRepoReturnsFailureReasonWhenExecFails");
}

async function main(): Promise<void> {
  testBuildCloneUrlEmbedsTokenForGithub();
  testBuildCloneUrlEmbedsTokenForBitbucket();
  await testCloneRepoInvokesGitCloneWithUrlAndTargetDir();
  await testCloneRepoReturnsFailureReasonWhenExecFails();
}

main();
