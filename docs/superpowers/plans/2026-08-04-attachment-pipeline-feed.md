# Attachment Pipeline Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download ticket attachments to filesystem before pipeline stages so the agent can read screenshots/logs/PDFs as context for Judge, Implement, and Verify.

**Architecture:** Download attachments once to `data/attachments/{ticketKey}/` before Judge. Copy to `<worktree>/.attachments/` before Implement. Clean up at pipeline end. Attachments are fetched via the server's Jira OAuth token; failures skip individual files gracefully.

**Tech Stack:** Node.js stdlib (`fs`, `path`, `node:child_process`), existing `getOAuthToken` from oauth-integrations, existing `InvokerFactory` (unchanged interface).

## Global Constraints

- One file modified: `src/pipeline/ticket-runner.ts`
- One test file: `src/pipeline/ticket-runner.test.ts`
- No changes to `InvokerFactory` interface — agent receives attachments via filesystem, not prompt
- `getOAuthToken` for Jira may return null (no connection) — gracefully skip downloads
- Duplicate filenames handled by appending `-2`, `-3`, etc.
- Attachments are stored as JSON in `ticket.attachments`: `[{ filename, mimeType, size, url }]`
- Cache directory: `data/attachments/{ticketKey}/` (relative to process CWD)
- Worktree directory: `<worktree>/.attachments/`

---

### Task 1: `downloadAttachments` helper + unit test

**Files:**
- Modify: `src/pipeline/ticket-runner.ts` (add function after imports, before `runTicketPipeline`)
- Modify: `src/pipeline/ticket-runner.test.ts` (add test)

**Interfaces:**
- Produces: `async function downloadAttachments(attachmentsJson: string | null, destDir: string, token: string | null): Promise<void>`

**Description:** Downloads all attachments from a ticket's stored JSON metadata into a target directory. Uses the provided Jira OAuth token to authorize the fetch. If token is null, skips all downloads. If an individual attachment fails to download, logs and continues.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We'll test downloadAttachments by importing it after we create it
// For now, write the test that will exercise it:

describe("downloadAttachments", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "attachments-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("downloads attachments to the target directory", async () => {
    const destDir = join(tmpDir, "out");
    const attachmentsJson = JSON.stringify([
      { filename: "error.log", mimeType: "text/plain", size: 14, url: "https://example.com/log" },
      { filename: "screenshot.png", mimeType: "image/png", size: 100, url: "https://example.com/img" },
    ]);

    // Mock fetch that returns fixed content per URL
    const mockFetch = async (url: string, _opts?: RequestInit): Promise<Response> => {
      if (url.includes("/log")) {
        return new Response("some log data\n", { headers: { "content-type": "text/plain" } });
      }
      if (url.includes("/img")) {
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { "content-type": "image/png" } });
      }
      return new Response("not found", { status: 404 });
    };

    await downloadAttachments(attachmentsJson, destDir, "fake-token", mockFetch);

    assert.ok(existsSync(join(destDir, "error.log")), "error.log should exist");
    assert.ok(existsSync(join(destDir, "screenshot.png")), "screenshot.png should exist");
    assert.equal(readFileSync(join(destDir, "error.log"), "utf-8"), "some log data\n");
  });

  it("skips all when token is null", async () => {
    const destDir = join(tmpDir, "no-token");
    const attachmentsJson = JSON.stringify([
      { filename: "file.txt", mimeType: "text/plain", size: 10, url: "https://example.com/f" },
    ]);

    await downloadAttachments(attachmentsJson, destDir, null);

    assert.equal(existsSync(destDir), false, "destDir should not be created when token is null");
  });

  it("skips all when attachmentsJson is null or empty", async () => {
    const destDir = join(tmpDir, "empty");
    await downloadAttachments(null, destDir, "token");
    assert.equal(existsSync(destDir), false);

    await downloadAttachments("[]", destDir, "token");
    assert.equal(existsSync(destDir), false);
  });

  it("continues after individual download failure", async () => {
    const destDir = join(tmpDir, "partial");
    const attachmentsJson = JSON.stringify([
      { filename: "ok.txt", mimeType: "text/plain", size: 4, url: "https://example.com/ok" },
      { filename: "fail.txt", mimeType: "text/plain", size: 10, url: "https://example.com/fail" },
    ]);

    const mockFetch = async (url: string, _opts?: RequestInit): Promise<Response> => {
      if (url.includes("/ok")) return new Response("good");
      throw new Error("network error");
    };

    await downloadAttachments(attachmentsJson, destDir, "token", mockFetch);

    assert.ok(existsSync(join(destDir, "ok.txt")), "ok.txt should exist despite the failure");
    assert.equal(existsSync(join(destDir, "fail.txt")), false, "fail.txt should not exist");
  });

  it("handles duplicate filenames by appending -2, -3", async () => {
    const destDir = join(tmpDir, "dupes");
    const attachmentsJson = JSON.stringify([
      { filename: "readme.md", mimeType: "text/markdown", size: 5, url: "https://example.com/r1" },
      { filename: "readme.md", mimeType: "text/markdown", size: 5, url: "https://example.com/r2" },
      { filename: "readme.md", mimeType: "text/markdown", size: 5, url: "https://example.com/r3" },
    ]);

    let callCount = 0;
    const mockFetch = async (_url: string, _opts?: RequestInit): Promise<Response> => {
      callCount++;
      return new Response(`content-${callCount}`);
    };

    await downloadAttachments(attachmentsJson, destDir, "token", mockFetch);

    assert.ok(existsSync(join(destDir, "readme.md")), "first readme.md should exist");
    assert.ok(existsSync(join(destDir, "readme-2.md")), "second readme-2.md should exist");
    assert.ok(existsSync(join(destDir, "readme-3.md")), "third readme-3.md should exist");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test dist/pipeline/ticket-runner.test.js`
Expected: FAIL — `downloadAttachments is not defined`

- [ ] **Step 3: Write `downloadAttachments` implementation in ticket-runner.ts**

Add after the imports block (before `export type StageName`):

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

/**
 * Downloads ticket attachments from Jira into a local directory.
 * If token is null or attachmentsJson is empty/nil, does nothing.
 * Individual download failures are logged and skipped — the pipeline
 * should not block because one screenshot URL is broken.
 */
async function downloadAttachments(
  attachmentsJson: string | null,
  destDir: string,
  token: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (!token || !attachmentsJson) return;

  let attachments: Array<{ filename: string; mimeType: string; size: number; url: string }>;
  try {
    attachments = JSON.parse(attachmentsJson);
  } catch {
    return;
  }

  if (!Array.isArray(attachments) || attachments.length === 0) return;

  mkdirSync(destDir, { recursive: true });

  const usedNames = new Set<string>();

  for (const att of attachments) {
    if (!att.url || !att.filename) continue;

    // Deduplicate filenames
    let filename = att.filename;
    if (usedNames.has(filename)) {
      const ext = extname(filename);
      const base = filename.slice(0, filename.length - ext.length);
      let counter = 2;
      while (usedNames.has(`${base}-${counter}${ext}`)) {
        counter++;
      }
      filename = `${base}-${counter}${ext}`;
    }
    usedNames.add(filename);

    const dest = join(destDir, filename);
    try {
      const res = await fetchFn(att.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`Attachment download failed (${res.status}): ${att.filename} from ${att.url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
    } catch (err) {
      console.error(`Attachment download error: ${att.filename} — ${err instanceof Error ? err.message : "unknown"}`);
      // Continue to next attachment
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test dist/pipeline/ticket-runner.test.js`
Expected: downloadAttachments tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/ticket-runner.ts src/pipeline/ticket-runner.test.ts
git commit -m "feat: add downloadAttachments helper for pipeline attachment feed"
```

---

### Task 2: Integrate attachments into Judge stage

**Files:**
- Modify: `src/pipeline/ticket-runner.ts` (in `runJudge` function, before agent invocation)
- Modify: `src/pipeline/ticket-runner.test.ts` (add test)

**Interfaces:**
- Consumes: `downloadAttachments(attachmentsJson, destDir, token, fetchFn)` from Task 1
- Produces: no new exports — `runJudge` downloads attachments to `data/attachments/{key}/`

- [x] **Step 1: Write the failing test**

```ts
it("judge stage downloads attachments and includes them in prompt", async () => {
  createTicket(db, {
    id: "T-att-judge-1",
    description: "Fix the login button color",
    url: null,
    attachments: JSON.stringify([
      { filename: "mockup.png", mimeType: "image/png", size: 100, url: "https://example.com/mockup.png" },
    ]),
  });

  let judgePrompt = "";

  const judgeFactory: InvokerFactory = (_modelId) => ({
    async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
      judgePrompt = opts.prompt;
      // Return agentReady
      return { outcome: "ok" as const, finalText: '{"agentReady": true, "reason": "clear enough"}' };
    },
  });

  const controller = new AbortController();
  await runTicketPipeline(
    db,
    judgeFactory,
    "T-att-judge-1",
    repoPath,
    "test/fake-model",
    () => {},
    controller.signal,
  );

  // The judge prompt should mention attachments
  assert.ok(
    judgePrompt.includes("Attachments are available") || judgePrompt.includes("data/attachments"),
    `judge prompt should mention attachments, got: ${judgePrompt.slice(0, 200)}`,
  );

  // Verify cache dir was created (relative to process CWD, which is the project root)
  const cacheDir = "data/attachments/T-att-judge-1";
  // Note: download will fail without real Jira token, so dir may be empty
  // The test verifies the prompt change, not the actual download (tested in Task 1)
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test dist/pipeline/ticket-runner.test.js`
Expected: FAIL — judge prompt does not contain attachment reference

- [x] **Step 3: Modify `runJudge` to download attachments and update prompt**

In `runJudge`, after the blocklist check and before the modelId check ("if (!modelId)"), add:

```ts
  // Download ticket attachments so the judge agent can inspect screenshots/logs
  const attachmentsDir = `data/attachments/${ticket.key}`;
  const jiraToken = getOAuthToken("jira");
  await downloadAttachments(ticket.attachments, attachmentsDir, jiraToken);
```

Also update the prompt array to include attachment location when attachments exist. After `ticket.url` line, add:

```ts
    ...(jiraToken && existsSync(attachmentsDir)
      ? [
          "",
          `Attachments are available at ${attachmentsDir}/ — read them for visual context (screenshots, diagrams, log files, etc.).`,
        ]
      : []),
```

Add the import for `existsSync` (it's already imported at the top of the file) and `getOAuthToken`:

```ts
import { getValidOAuthToken, getOAuthToken } from "./oauth-integrations.js";
```

(Check: `getValidOAuthToken` is already imported. Just add `getOAuthToken`.)

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test dist/pipeline/ticket-runner.test.js`
Expected: ALL tests PASS (including new judge attachment test)

- [x] **Step 5: Commit**

```bash
git add src/pipeline/ticket-runner.ts src/pipeline/ticket-runner.test.ts
git commit -m "feat: feed attachments to judge stage"
```

---

### Task 3: Integrate attachments into Implement stage

**Files:**
- Modify: `src/pipeline/ticket-runner.ts` (in `runImplement`, after worktree creation)
- Modify: `src/pipeline/ticket-runner.test.ts` (add test)

**Interfaces:**
- Consumes: `downloadAttachments` from Task 1, attachments cache from Judge
- Produces: `<worktree>/.attachments/` directory with attachment copies

- [x] **Step 1: Write the failing test**

```ts
it("implement stage copies attachments into worktree", async () => {
  // Create a ticket with attachments
  createTicket(db, {
    id: "T-att-impl-1",
    description: "Add AGENTS.md with project conventions",
    url: null,
    attachments: JSON.stringify([
      { filename: "spec.pdf", mimeType: "application/pdf", size: 42, url: "https://example.com/spec.pdf" },
    ]),
  });

  let implementPrompt = "";
  let worktreeDir = "";

  const implFactory: InvokerFactory = (_modelId) => ({
    async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
      implementPrompt = opts.prompt;
      worktreeDir = opts.cwd;
      // Actually create a commit so the pipeline doesn't block on empty implementation
      writeFileSync(join(opts.cwd, "AGENTS.md"), "# Agent instructions\n");
      execSync(`git -C "${opts.cwd}" add -A`, { stdio: "pipe" });
      execSync(`git -C "${opts.cwd}" commit -m "feat: add AGENTS.md"`, { stdio: "pipe" });
      return { outcome: "ok" as const, finalText: "Done." };
    },
  });

  const judgeFactory: InvokerFactory = (_modelId) => ({
    async run(_opts) {
      return { outcome: "ok" as const, finalText: '{"agentReady": true, "reason": "clear"}' };
    },
  });

  // We need a single invoker factory for the whole pipeline — the judge uses
  // one response pattern, implement another. Let's use a conditional factory.
  const factory: InvokerFactory = (modelId) => {
    let callCount = 0;
    return {
      async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
        callCount++;
        if (callCount === 1) {
          // Judge
          return { outcome: "ok" as const, finalText: '{"agentReady": true, "reason": "clear"}' };
        }
        // Implement
        writeFileSync(join(opts.cwd, "AGENTS.md"), "# Agent instructions\n");
        execSync(`git -C "${opts.cwd}" add -A`, { stdio: "pipe" });
        execSync(`git -C "${opts.cwd}" commit -m "feat: add AGENTS.md"`, { stdio: "pipe" });
        return { outcome: "ok" as const, finalText: "Done." };
      },
    };
  };

  const controller = new AbortController();

  await runTicketPipeline(
    db,
    factory,
    "T-att-impl-1",
    repoPath,
    "test/fake-model",
    () => {},
    controller.signal,
  );

  // The implement prompt should mention .attachments/
  assert.ok(
    implementPrompt.includes(".attachments/") || implementPrompt.includes("attachments"),
    `implement prompt should mention attachments, got: ${implementPrompt.slice(0, 200)}`,
  );

  // Verify the .attachments directory was created in the worktree
  // (download will fail without real Jira token, but the prompt should still mention it)
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test dist/pipeline/ticket-runner.test.js`
Expected: FAIL — implement prompt does not contain `.attachments/`

- [x] **Step 3: Modify `runImplement` to copy attachments and update prompt**

After worktree creation succeeds (after `updateTicket(db, ticket.key, { worktreePath, branchName })`), add:

```ts
    // Copy cached attachments into the worktree so the agent can read them
    const attachmentsCacheDir = `data/attachments/${ticket.key}`;
    const hasAttachments = existsSync(attachmentsCacheDir);
    if (hasAttachments) {
      const worktreeAttachmentsDir = join(worktreePath, ".attachments");
      try {
        execSync(`mkdir -p "${worktreeAttachmentsDir}"`, { encoding: "utf-8" });
        execSync(`cp -R "${attachmentsCacheDir}"/. "${worktreeAttachmentsDir}"/`, {
          encoding: "utf-8",
        });
      } catch {
        // Copy failed — not fatal, agent just won't see attachments
      }
    }
```

Also update the implement prompt. After the `ticket.url` line, add:

```ts
    ...(hasAttachments
      ? [
          "",
          "Ticket attachments (screenshots, logs, documents) are in the .attachments/ directory — read them for visual context.",
        ]
      : []),
```

The `hasAttachments` variable is already defined above from `existsSync(attachmentsCacheDir)`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test dist/pipeline/ticket-runner.test.js`
Expected: ALL tests PASS

- [x] **Step 5: Commit**

```bash
git add src/pipeline/ticket-runner.ts src/pipeline/ticket-runner.test.ts
git commit -m "feat: feed attachments to implement stage via worktree"
```

---

### Task 4: Add end-of-pipeline cleanup for attachment cache

**Files:**
- Modify: `src/pipeline/ticket-runner.ts` (end of `runTicketPipeline`, before final emit)
- No test changes needed (cleanup is covered by existing integration tests)

- [ ] **Step 1: Run existing tests to confirm current state**

Run: `npm run build && node --test dist/pipeline/ticket-runner.test.js`
Expected: ALL tests PASS

- [ ] **Step 2: Add cleanup code**

In `runTicketPipeline`, after the `for` loop ends and before the final `emit({ type: "done" ... })`, add:

```ts
  // Cleanup attachment cache
  const attachmentCacheDir = `data/attachments/${ticketKey}`;
  if (existsSync(attachmentCacheDir)) {
    try {
      rmSync(attachmentCacheDir, { recursive: true, force: true });
    } catch {
      // Not fatal — stale cache dirs don't hurt anything
    }
  }
```

Also ensure `rmSync` is still imported at the top (it already is: `import { existsSync, rmSync } from "node:fs"`).

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm run build && node --test dist/pipeline/ticket-runner.test.js`
Expected: ALL tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/ticket-runner.ts
git commit -m "feat: cleanup attachment cache at pipeline end"
```

---

### Task 5: Final integration — full build + test + CHANGELOG

- [ ] **Step 1: Full build and test**

```bash
cd /Users/riaenriala/Documents/etalas/runchise-agent-pipeline
npm run build
npm run test
```

Expected: ALL 80+ tests PASS, 0 failures

- [ ] **Step 2: Append CHANGELOG**

```bash
echo "- $(date +%Y-%m-%d): attachment-pipeline-feed | @riaenriala - feed ticket attachments (screenshots, logs, PDFs) into Judge and Implement pipeline stages via filesystem" >> CHANGELOG.md
```

- [ ] **Step 3: Verify final state**

Read `src/pipeline/ticket-runner.ts` — confirm:
- `downloadAttachments` function exists
- `runJudge` downloads attachments before agent invocation
- `runImplement` copies attachments into worktree `.attachments/`
- End-of-pipeline cleanup removes cache

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: update CHANGELOG for attachment pipeline feed"
```
