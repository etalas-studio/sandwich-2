import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  piSessionsRoot,
  conversationSessionDir,
  deleteConversationSession,
  sessionExists,
  openConversationSession,
} from "./sessions.js";
import { ProjectPathError } from "./workspace.js";

describe("piSessionsRoot", () => {
  it("honours PI_SESSIONS_ROOT", () => {
    const prev = process.env.PI_SESSIONS_ROOT;
    process.env.PI_SESSIONS_ROOT = "/tmp/x/pi-sessions";
    try {
      assert.equal(piSessionsRoot(), "/tmp/x/pi-sessions");
    } finally {
      if (prev === undefined) delete process.env.PI_SESSIONS_ROOT;
      else process.env.PI_SESSIONS_ROOT = prev;
    }
  });

  it("dev fallback is absolute and ends in data/pi-sessions", () => {
    const prev = process.env.PI_SESSIONS_ROOT;
    delete process.env.PI_SESSIONS_ROOT;
    try {
      const root = piSessionsRoot();
      assert.ok(root.startsWith("/"));
      assert.ok(root.endsWith("data/pi-sessions"));
    } finally {
      if (prev !== undefined) process.env.PI_SESSIONS_ROOT = prev;
    }
  });
});

describe("conversationSessionDir", () => {
  it("is a child of the sessions root, never the project root", () => {
    const prevP = process.env.PI_SESSIONS_ROOT;
    const prevR = process.env.PROJECTS_ROOT;
    process.env.PI_SESSIONS_ROOT = "/data/pi-sessions";
    process.env.PROJECTS_ROOT = "/data/projects";
    try {
      const dir = conversationSessionDir("conv-1");
      assert.equal(dir, "/data/pi-sessions/conv-1");
      assert.ok(!dir.startsWith("/data/projects"));
    } finally {
      if (prevP === undefined) delete process.env.PI_SESSIONS_ROOT;
      else process.env.PI_SESSIONS_ROOT = prevP;
      if (prevR === undefined) delete process.env.PROJECTS_ROOT;
      else process.env.PROJECTS_ROOT = prevR;
    }
  });

  it("rejects unsafe conversation ids", () => {
    for (const bad of ["", "..", "a/b", "x\0y"]) {
      assert.throws(() => conversationSessionDir(bad), ProjectPathError);
    }
  });
});

describe("sessionExists / openConversationSession", () => {
  it("round-trips a session and never writes into the project dir", async () => {
    const prevS = process.env.PI_SESSIONS_ROOT;
    const sessRoot = mkdtempSync(join(tmpdir(), "pi-sess-rt-"));
    const projectDir = mkdtempSync(join(tmpdir(), "proj-rt-"));
    process.env.PI_SESSIONS_ROOT = sessRoot;
    try {
      assert.equal(sessionExists("cv-rt"), false);

      const mgr = (await openConversationSession("cv-rt", projectDir)) as {
        getCwd(): string;
        getSessionDir(): string | undefined;
        getSessionFile(): string | undefined;
        appendMessage(m: unknown): string;
        getEntries(): unknown[];
      };

      // cwd is the shared project dir; the session store is elsewhere.
      assert.equal(mgr.getCwd(), projectDir);
      assert.equal(mgr.getSessionDir(), conversationSessionDir("cv-rt"));
      const file = mgr.getSessionFile();
      assert.ok(file && file.startsWith(sessRoot));
      assert.ok(!file!.startsWith(projectDir));

      mgr.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
      assert.ok(mgr.getEntries().length >= 1);

      // No session artefact in the project directory — M2-05's core guarantee.
      assert.equal(existsSync(join(projectDir, ".pi")), false);
      assert.deepEqual(
        readdirSync(projectDir).filter((f: string) => f.endsWith(".jsonl")),
        [],
      );
    } finally {
      if (prevS === undefined) delete process.env.PI_SESSIONS_ROOT;
      else process.env.PI_SESSIONS_ROOT = prevS;
      rmSync(sessRoot, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("deleteConversationSession", () => {
  it("removes the session dir and never throws when absent", () => {
    const prev = process.env.PI_SESSIONS_ROOT;
    const root = mkdtempSync(join(tmpdir(), "pi-sess-"));
    process.env.PI_SESSIONS_ROOT = root;
    try {
      const dir = conversationSessionDir("c1");
      mkdirSync(dir, { recursive: true });
      assert.ok(existsSync(dir));
      deleteConversationSession("c1");
      assert.ok(!existsSync(dir));
      deleteConversationSession("c1"); // idempotent, no throw
    } finally {
      if (prev === undefined) delete process.env.PI_SESSIONS_ROOT;
      else process.env.PI_SESSIONS_ROOT = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
