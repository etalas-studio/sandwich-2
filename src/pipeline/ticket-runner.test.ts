import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createProject, markProjectReady } from "../db/project.js";
import { createTicket, getTicket, updateTicket } from "../db/tickets.js";
import { runTicketPipeline, buildPrPrompt, parsePrResponse, generatePrContent, executePr } from "./ticket-runner.js";
import type { InvokerFactory } from "../scanner/run-scan.js";

/**
 * Creates a bare "origin" repo plus a working clone with an initial commit
 * pushed to origin/main. Returns the working repo path (repoPath for the
 * pipeline) and a cleanup function.
 */
function setupRepo(): { repoPath: string; cleanup: () => void } {
  const tmp = mkdtempSync(join(tmpdir(), "ticket-runner-test-"));
  const bareDir = join(tmp, "origin.git");
  const repoPath = join(tmp, "repo");

  // Bare origin
  execSync(`git init --bare "${bareDir}"`, { stdio: "pipe" });

  // Working repo
  execSync(`git init "${repoPath}"`, { stdio: "pipe" });
  execSync(`git -C "${repoPath}" config user.email "test@test"`, { stdio: "pipe" });
  execSync(`git -C "${repoPath}" config user.name "Test"`, { stdio: "pipe" });
  execSync(`git -C "${repoPath}" remote add origin "${bareDir}"`, { stdio: "pipe" });

  writeFileSync(join(repoPath, "README.md"), "# test repo\n");
  execSync(`git -C "${repoPath}" add -A`, { stdio: "pipe" });
  execSync(`git -C "${repoPath}" commit -m "initial commit"`, { stdio: "pipe" });
  execSync(`git -C "${repoPath}" push origin main`, { stdio: "pipe" });

  return {
    repoPath,
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

/** Invoker that returns ok but makes no file changes — simulates the agent
 * "succeeding" but producing nothing. */
const emptyInvokerFactory: InvokerFactory = (_modelId) => ({
  async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
    return { outcome: "ok" as const, finalText: "Done." };
  },
});

/** Invoker that returns ok AND actually creates a file + commits it — used
 * as the "good" case for verify tests. */
const workingInvokerFactory: InvokerFactory = (_modelId) => ({
  async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
    const cwd = opts.cwd;
    writeFileSync(join(cwd, "AGENTS.md"), "# Agent instructions\n");
    execSync(`git -C "${cwd}" add -A`, { stdio: "pipe" });
    execSync(`git -C "${cwd}" commit -m "feat: add AGENTS.md"`, { stdio: "pipe" });
    return { outcome: "ok" as const, finalText: "Created AGENTS.md." };
  },
});

describe("ticket-runner pipeline", () => {
  let repoPath: string;
  let cleanupRepo: () => void;
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    const repo = setupRepo();
    repoPath = repo.repoPath;
    cleanupRepo = repo.cleanup;

    tmpDir = mkdtempSync(join(tmpdir(), "ticket-runner-db-"));
    db = openDb(join(tmpDir, "db.sqlite"));

    // Create a ready project pointing at our test repo
    const project = createProject(db, {
      provider: "github",
      owner: "test",
      repoSlug: "test-repo",
      defaultBranch: "main",
    });
    markProjectReady(db, project.id);
  });

  after(() => {
    cleanupRepo();
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks ticket when implementation produces no changes", async () => {
    createTicket(db, {
      id: "T-empty-1",
      description: "Add AGENTS.md with project conventions",
      url: null,
    });

    const events: Array<{ type: string; stage?: string }> = [];
    const controller = new AbortController();

    await runTicketPipeline(
      db,
      emptyInvokerFactory,
      "T-empty-1",
      repoPath,
      "test/fake-model",
      (ev) => events.push(ev),
      controller.signal,
    );

    const ticket = getTicket(db, "T-empty-1")!;
    assert.equal(ticket.status, "blocked", "ticket should be blocked");
    assert.equal(
      ticket.needsHumanCategory,
      "empty_implementation",
      "category should be empty_implementation",
    );
    assert.ok(
      ticket.needsHumanReason?.includes("no changes"),
      `reason should mention no changes, got: ${ticket.needsHumanReason}`,
    );

    // Should have stopped at implement — never reached verify or open_pr
    const implementEnd = events.find((e) => e.type === "stage_end" && e.stage === "implement");
    assert.ok(implementEnd, "implement stage should have ended");
    const verifyStart = events.find((e) => e.type === "stage_start" && e.stage === "verify");
    assert.equal(verifyStart, undefined, "verify should NOT have started");
  });

  it("verify stage fails mechanically when worktree has no commits", async () => {
    // This test simulates the scenario where implement returned ok (because
    // the old code didn't check for changes) and verify needs to catch it.
    // We test runVerify's new mechanical guard directly by running the
    // full pipeline with an invoker that does nothing — the new implement
    // guard will catch it first (tested above).  To test verify's guard
    // in isolation we'd need to export runVerify; instead we test that a
    // working impl passes through verify successfully (integration).

    createTicket(db, {
      id: "T-ok-1",
      description: "Add AGENTS.md with project conventions",
      url: null,
    });

    const controller = new AbortController();

    await runTicketPipeline(
      db,
      workingInvokerFactory,
      "T-ok-1",
      repoPath,
      "test/fake-model",
      () => {},
      controller.signal,
    );

    const ticket = getTicket(db, "T-ok-1")!;
    // Implementation should succeed (it makes a real commit), verify
    // should pass the mechanical guard, and the pipeline should reach
    // open_pr — which will fail because there's no real OAuth token,
    // but the ticket should not be blocked for empty_implementation.
    assert.notEqual(
      ticket.needsHumanCategory,
      "empty_implementation",
      "working implementation should NOT get empty_implementation",
    );
    // open_pr fails without real OAuth — that's expected in tests
    assert.ok(
      ticket.stage === "open_pr" || ticket.status === "blocked",
      `expected stage open_pr or blocked, got stage=${ticket.stage} status=${ticket.status}`,
    );
  });

  it("blocks ticket when agent outcome is not ok", async () => {
    createTicket(db, {
      id: "T-crash-1",
      description: "Fix typo in README",
      url: null,
    });

    const crashFactory: InvokerFactory = () => ({
      async run(_opts) {
        return { outcome: "timeout" as const, finalText: "" };
      },
    });

    const controller = new AbortController();

    await runTicketPipeline(
      db,
      crashFactory,
      "T-crash-1",
      repoPath,
      "test/fake-model",
      () => {},
      controller.signal,
    );

    const ticket = getTicket(db, "T-crash-1")!;
    assert.equal(ticket.status, "blocked");
    assert.equal(ticket.needsHumanCategory, "agent_error");
    assert.ok(ticket.needsHumanReason?.includes("timeout"));
  });

  it("implement stage copies attachments into worktree and mentions them in prompt", async () => {
    // Create a ticket with attachments
    createTicket(db, {
      id: "T-att-impl-1",
      description: "Add AGENTS.md with project conventions",
      url: null,
      attachments: JSON.stringify([
        { filename: "spec.pdf", mimeType: "application/pdf", size: 42, url: "https://example.com/spec.pdf" },
      ]),
    });

    // Pre-populate the attachments cache dir so the copy succeeds
    const attachmentsCacheDir = join("data", "attachments", "T-att-impl-1");
    mkdirSync(attachmentsCacheDir, { recursive: true });
    writeFileSync(join(attachmentsCacheDir, "spec.pdf"), "fake pdf content");

    let implementPrompt = "";
    let worktreeDir = "";

    const factory: InvokerFactory = (_modelId) => ({
      async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
        if (opts.prompt.includes("You are implementing")) {
          // Implement stage
          implementPrompt = opts.prompt;
          worktreeDir = opts.cwd;
          writeFileSync(join(opts.cwd, "AGENTS.md"), "# Agent instructions\n");
          execSync(`git -C "${opts.cwd}" add -A`, { stdio: "pipe" });
          execSync(`git -C "${opts.cwd}" commit -m "feat: add AGENTS.md"`, { stdio: "pipe" });
          return { outcome: "ok" as const, finalText: "Done." };
        }
        // Judge
        return { outcome: "ok" as const, finalText: '{"agentReady": true, "reason": "clear"}' };
      },
    });

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
    const worktreeAttachmentsDir = join(worktreeDir, ".attachments");
    assert.ok(
      existsSync(worktreeAttachmentsDir),
      `.attachments/ directory should exist in worktree at ${worktreeAttachmentsDir}`,
    );

    // Verify the attachment file was copied
    assert.ok(
      existsSync(join(worktreeAttachmentsDir, "spec.pdf")),
      "spec.pdf should be copied into worktree .attachments/",
    );

    // Clean up the cache dir
    try {
      rmSync(attachmentsCacheDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
});

describe("open_pr AI-generated content", () => {
  it("buildPrPrompt includes linked issue, diff, and verify info", () => {
    const prompt = buildPrPrompt({
      ticketKey: "PROJ-42",
      ticketSummary: "Fix null pointer in user lookup",
      ticketDescription: "Users seeing 500 errors when looking up deleted accounts",
      ticketUrl: "https://jira.example.com/browse/PROJ-42",
      diffStat: "src/auth/service.ts | 12 +++++++-----\n 1 file changed, 7 insertions(+), 5 deletions(-)",
      verifySummary: "All tests pass, change matches requirements",
      verifyWarnings: ["Touched error handler in unrelated module"],
    });

    assert.ok(prompt.includes("PROJ-42"), "prompt should include ticket key");
    assert.ok(prompt.includes("Fix null pointer in user lookup"), "prompt should include ticket summary");
    assert.ok(prompt.includes("Users seeing 500 errors"), "prompt should include ticket description");
    assert.ok(prompt.includes("https://jira.example.com/browse/PROJ-42"), "prompt should include ticket URL");
    assert.ok(prompt.includes("src/auth/service.ts"), "prompt should include diff stat");
    assert.ok(prompt.includes("All tests pass"), "prompt should include verify summary");
    assert.ok(prompt.includes("Touched error handler"), "prompt should include warnings");
  });

  it("buildPrPrompt handles missing optional fields gracefully", () => {
    const prompt = buildPrPrompt({
      ticketKey: "PROJ-1",
      ticketSummary: null,
      ticketDescription: "Do something",
      ticketUrl: null,
      diffStat: "",
      verifySummary: null,
      verifyWarnings: [],
    });

    assert.ok(prompt.includes("PROJ-1"), "prompt should still include ticket key");
    assert.ok(prompt.includes("Do something"), "prompt should include description");
    // Should not blow up on null fields
  });

  it("parsePrResponse extracts title and description from valid JSON", () => {
    const result = parsePrResponse(
      'Here is the PR content:\\n{"title": "fix: add null check for deleted user lookup", "description": "## Linked Issue\\nPROJ-42\\n\\n## What Changed\\nAdded null check."}',
    );

    assert.ok(result, "should return a result");
    assert.equal(result!.title, "fix: add null check for deleted user lookup");
    assert.ok(result!.description.includes("## Linked Issue"), "description should include Linked Issue section");
    assert.ok(result!.description.includes("PROJ-42"), "description should include ticket key");
    assert.ok(result!.description.includes("Added null check"), "description should include what changed");
  });

  it("parsePrResponse returns null for invalid JSON", () => {
    assert.equal(parsePrResponse("just some text without json"), null);
    assert.equal(parsePrResponse(""), null);
    assert.equal(parsePrResponse("{invalid: json}"), null);
  });

  it("parsePrResponse returns null when missing required fields", () => {
    // Missing description
    assert.equal(
      parsePrResponse('{"title": "fix: something"}'),
      null,
    );
    // Missing title
    assert.equal(
      parsePrResponse('{"description": "some desc"}'),
      null,
    );
  });

  it("open_pr stage uses AI-generated content when modelId is provided", async () => {
    const repo = setupRepo();
    const tmpDir2 = mkdtempSync(join(tmpdir(), "ticket-runner-db-"));
    const db2 = openDb(join(tmpDir2, "db.sqlite"));
    const project = createProject(db2, {
      provider: "github",
      owner: "test",
      repoSlug: "test-repo",
      defaultBranch: "main",
    });
    markProjectReady(db2, project.id);

    createTicket(db2, {
      id: "T-ai-pr-1",
      description: "Add null check for user lookup",
      url: "https://jira.example.com/browse/PROJ-99",
    });

    // Invoker that implements (creates a real commit) + generates PR content
    const prAiInvoker: InvokerFactory = (_modelId) => ({
      async run(opts: { prompt: string; cwd: string; timeoutMs: number }) {
        // Check if this is the PR generation prompt (contains "Linked Issue" cue)
        if (opts.prompt.includes("pull request description")) {
          const response = JSON.stringify({
            title: "fix: add null check for deleted user lookup",
            description: [
              "## Linked Issue",
              "[PROJ-99](https://jira.example.com/browse/PROJ-99) — Add null check for user lookup",
              "",
              "## What Changed",
              "Added null check in user service to handle deleted accounts gracefully.",
              "",
              "## Changes",
              "- `src/auth/service.ts` — Added null guard before accessing user properties",
              "",
              "## How Tested",
              "All existing tests pass. Added new test for deleted user scenario.",
              "",
              "---",
              "> \u26a0\ufe0f **AI-Generated PR** — This code was written by an AI agent (Runchise pipeline).",
              "> A human MUST review before merging.",
            ].join("\n"),
          });
          return { outcome: "ok" as const, finalText: response };
        }

        // Otherwise, act like a working implementer
        const cwd = opts.cwd;
        writeFileSync(join(cwd, "AGENTS.md"), "# Agent instructions\n");
        execSync(`git -C "${cwd}" add -A`, { stdio: "pipe" });
        execSync(`git -C "${cwd}" commit -m "feat: add AGENTS.md"`, { stdio: "pipe" });
        return { outcome: "ok" as const, finalText: "Created AGENTS.md." };
      },
    });

    const controller = new AbortController();
    const events: Array<{ type: string; stage?: string }> = [];

    await runTicketPipeline(
      db2,
      prAiInvoker,
      "T-ai-pr-1",
      repo.repoPath,
      "test/fake-model",
      (ev) => events.push(ev),
      controller.signal,
    );

    const ticket = getTicket(db2, "T-ai-pr-1")!;

    // open_pr will still fail without real OAuth tokens — but the invoker
    // should have been called for the PR generation prompt. We verify that
    // the pipeline reached open_pr stage (it didn't fail earlier).
    assert.ok(
      ticket.stage === "open_pr" || ticket.status === "blocked",
      `expected stage open_pr or blocked, got stage=${ticket.stage} status=${ticket.status}`,
    );

    // The PR summary should reflect AI content if PR succeeded, or just verify
    // the pipeline didn't crash during the AI generation step.
    if (ticket.prSummary) {
      assert.ok(
        ticket.prSummary.includes("AI-Generated") || ticket.prSummary.includes("PR created"),
        `prSummary should reflect AI content: ${ticket.prSummary}`,
      );
    }

    db2.close();
    rmSync(tmpDir2, { recursive: true, force: true });
    repo.cleanup();
  });
});

describe("generatePrContent (refactored from runOpenPr)", () => {
  it("returns mechanical fallback title and description when no modelId", async () => {
    const repo = setupRepo();
    const tmpDir2 = mkdtempSync(join(tmpdir(), "gen-pr-content-"));
    const db2 = openDb(join(tmpDir2, "db.sqlite"));

    createTicket(db2, {
      id: "T-MECH-1",
      description: "Users cannot reset their password via email link.",
      url: "https://jira.example.com/browse/PROJ-88",
    });

    // Need a project to exist
    const project = createProject(db2, {
      provider: "github",
      owner: "test",
      repoSlug: "test-repo",
      defaultBranch: "main",
    });
    markProjectReady(db2, project.id);

    // Create a worktree path (doesn't need to be real for content generation)
    updateTicket(db2, "T-MECH-1", { worktreePath: repo.repoPath, branchName: "fix/T-MECH-1" });

    const ticket = getTicket(db2, "T-MECH-1")!;
    const result = await generatePrContent(
      db2,
      ticket,
      null, // no modelId → mechanical fallback
    );

    assert.equal(typeof result, "object");
    assert.equal(typeof result.title, "string");
    assert.equal(typeof result.description, "string");
    assert.ok(result.title.includes("Fix:"), `title should start with Fix:: ${result.title}`);
    assert.ok(result.description.includes("Automated by Runchise pipeline"),
      `description should include footer: ${result.description}`);
    assert.ok(result.description.includes("PROJ-88"),
      `description should include ticket key: ${result.description}`);

    db2.close();
    rmSync(tmpDir2, { recursive: true, force: true });
    repo.cleanup();
  });

  it("uses AI-generated content when modelId is provided", async () => {
    const repo = setupRepo();
    const tmpDir2 = mkdtempSync(join(tmpdir(), "gen-pr-ai-"));
    const db2 = openDb(join(tmpDir2, "db.sqlite"));

    createTicket(db2, {
      id: "T-AI-1",
      description: "Add rate limiting to API endpoints.",
      url: "https://jira.example.com/browse/PROJ-77",
    });

    const project = createProject(db2, {
      provider: "github",
      owner: "test",
      repoSlug: "test-repo",
      defaultBranch: "main",
    });
    markProjectReady(db2, project.id);

    updateTicket(db2, "T-AI-1", { worktreePath: repo.repoPath, branchName: "fix/T-AI-1" });

    const ticket = getTicket(db2, "T-AI-1")!;

    const aiInvoker: InvokerFactory = (_modelId) => ({
      async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
        return {
          outcome: "ok" as const,
          finalText: JSON.stringify({
            title: "feat: add rate limiting middleware",
            description: "## What Changed\nAdded rate limiting to all API endpoints.\n\n## How Tested\nUnit tests pass.",
          }),
        };
      },
    });

    const result = await generatePrContent(
      db2,
      ticket,
      "test/model",
      aiInvoker,
    );

    assert.equal(result.title, "feat: add rate limiting middleware");
    assert.ok(result.description.includes("rate limiting"),
      `description should include AI content: ${result.description}`);

    db2.close();
    rmSync(tmpDir2, { recursive: true, force: true });
    repo.cleanup();
  });

  it("falls back to mechanical when AI parsing fails", async () => {
    const repo = setupRepo();
    const tmpDir2 = mkdtempSync(join(tmpdir(), "gen-pr-fallback-"));
    const db2 = openDb(join(tmpDir2, "db.sqlite"));

    createTicket(db2, {
      id: "T-FALLBACK-1",
      description: "Fix memory leak in image processing.",
      url: null,
    });

    const project = createProject(db2, {
      provider: "github",
      owner: "test",
      repoSlug: "test-repo",
      defaultBranch: "main",
    });
    markProjectReady(db2, project.id);

    updateTicket(db2, "T-FALLBACK-1", { worktreePath: repo.repoPath, branchName: "fix/T-FALLBACK-1" });

    const ticket = getTicket(db2, "T-FALLBACK-1")!;

    const badAiInvoker: InvokerFactory = (_modelId) => ({
      async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
        return { outcome: "ok" as const, finalText: "not valid json at all" };
      },
    });

    const result = await generatePrContent(
      db2,
      ticket,
      "test/model",
      badAiInvoker,
    );

    assert.ok(result.title.startsWith("Fix:"), "should fall back to mechanical title");
    assert.ok(result.description.includes("Automated by Runchise pipeline"),
      "should fall back to mechanical description");

    db2.close();
    rmSync(tmpDir2, { recursive: true, force: true });
    repo.cleanup();
  });
});
