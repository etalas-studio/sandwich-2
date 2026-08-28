import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  projectsRoot,
  projectDirPath,
  resolveInsideProject,
  getProjectDir,
  runGit,
  commitPaths,
  headSha,
  rollbackDeliverable,
  ensureGitignore,
  ProjectPathError,
  DELIVERABLE_FILES,
} from "./workspace.js";

/** Runs `fn`, asserts it threw a ProjectPathError, returns it for `.reason` checks. */
function expectPathError(fn: () => unknown): ProjectPathError {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ProjectPathError, `expected ProjectPathError, got ${err}`);
    return err;
  }
  assert.fail("expected ProjectPathError, but nothing was thrown");
}

function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const GIT = hasGit();

describe("projectsRoot", () => {
  it("honours PROJECTS_ROOT when set", () => {
    const prev = process.env.PROJECTS_ROOT;
    process.env.PROJECTS_ROOT = "/tmp/somewhere/projects";
    try {
      assert.equal(projectsRoot(), "/tmp/somewhere/projects");
    } finally {
      if (prev === undefined) delete process.env.PROJECTS_ROOT;
      else process.env.PROJECTS_ROOT = prev;
    }
  });

  it("dev fallback is an absolute path under the repo", () => {
    const prev = process.env.PROJECTS_ROOT;
    delete process.env.PROJECTS_ROOT;
    try {
      const root = projectsRoot();
      assert.ok(root.startsWith("/"));
      assert.ok(root.endsWith("data/projects"));
    } finally {
      if (prev !== undefined) process.env.PROJECTS_ROOT = prev;
    }
  });
});

describe("projectDirPath", () => {
  it("composes root/userId/projectId", () => {
    const prev = process.env.PROJECTS_ROOT;
    process.env.PROJECTS_ROOT = "/data/projects";
    try {
      assert.equal(projectDirPath("u1", "p1"), "/data/projects/u1/p1");
    } finally {
      if (prev === undefined) delete process.env.PROJECTS_ROOT;
      else process.env.PROJECTS_ROOT = prev;
    }
  });

  it("rejects unsafe id segments", () => {
    for (const bad of ["", ".", "..", "a/b", "a\\b", "x\0y"]) {
      assert.throws(() => projectDirPath(bad, "p1"), ProjectPathError);
      assert.throws(() => projectDirPath("u1", bad), ProjectPathError);
    }
  });
});

describe("resolveInsideProject", () => {
  let root: string;
  let outside: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "ws-root-"));
    outside = mkdtempSync(join(tmpdir(), "ws-outside-"));
    mkdirSync(join(root, "prototype"), { recursive: true });
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("resolves plain and nested paths inside the project", () => {
    assert.equal(resolveInsideProject(root, "prd.md"), join(root, "prd.md"));
    assert.equal(
      resolveInsideProject(root, DELIVERABLE_FILES.prototype),
      join(root, "prototype", "index.html"),
    );
  });

  it("rejects traversal", () => {
    for (const bad of ["../secret.md", "a/../../secret.md", "./../x"]) {
      assert.equal(expectPathError(() => resolveInsideProject(root, bad)).reason, "traversal");
    }
  });

  it("rejects absolute paths (posix and windows-style)", () => {
    for (const bad of ["/etc/passwd", "C:\\Windows\\win.ini", "\\\\server\\share"]) {
      assert.equal(expectPathError(() => resolveInsideProject(root, bad)).reason, "absolute");
    }
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "file\0.md"]) {
      assert.equal(expectPathError(() => resolveInsideProject(root, bad)).reason, "invalid");
    }
  });

  it("rejects a sibling directory sharing the root's name prefix", () => {
    const evil = `${root}-evil`;
    mkdirSync(evil, { recursive: true });
    try {
      expectPathError(() => resolveInsideProject(root, `../${basename(root)}-evil/x`));
    } finally {
      rmSync(evil, { recursive: true, force: true });
    }
  });

  it("rejects escape through a symlinked directory", () => {
    symlinkSync(outside, join(root, "link"));
    assert.equal(expectPathError(() => resolveInsideProject(root, "link/x.md")).reason, "symlink");
  });

  it("rejects a symlinked file that points outside", () => {
    const target = join(outside, "target.md");
    writeFileSync(target, "x");
    symlinkSync(target, join(root, "esc.md"));
    assert.equal(expectPathError(() => resolveInsideProject(root, "esc.md")).reason, "symlink");
  });

  it("allows a symlink that stays inside the project", () => {
    writeFileSync(join(root, "real.md"), "hi");
    symlinkSync(join(root, "real.md"), join(root, "alias.md"));
    assert.equal(resolveInsideProject(root, "alias.md"), join(root, "alias.md"));
  });

  it("resolves cleanly when root came from mkdtemp (macOS /var symlink)", () => {
    // This is the regression test for realpath'ing the root, not just the target.
    assert.equal(resolveInsideProject(root, "clean.md"), join(root, "clean.md"));
  });
});

describe("getProjectDir", { skip: GIT ? false : "git not available" }, () => {
  let tmpRoot: string;
  let prevRoot: string | undefined;

  before(() => {
    prevRoot = process.env.PROJECTS_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), "ws-projects-"));
    process.env.PROJECTS_ROOT = tmpRoot;
  });
  after(() => {
    if (prevRoot === undefined) delete process.env.PROJECTS_ROOT;
    else process.env.PROJECTS_ROOT = prevRoot;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("creates the dir, inits git, and makes exactly one commit", async () => {
    const dir = await getProjectDir("u1", "p1");
    assert.ok(existsSync(dir));
    assert.ok(existsSync(join(dir, ".git", "HEAD")));
    const { stdout } = await runGit(dir, ["rev-list", "--count", "HEAD"]);
    assert.equal(stdout.trim(), "1");
  });

  it("is idempotent — a second call adds no commit", async () => {
    const dir = await getProjectDir("u1", "p1");
    const { stdout } = await runGit(dir, ["rev-list", "--count", "HEAD"]);
    assert.equal(stdout.trim(), "1");
  });

  it("serialises concurrent first-time calls into one commit", async () => {
    const [a, b] = await Promise.all([getProjectDir("u2", "p2"), getProjectDir("u2", "p2")]);
    assert.equal(a, b);
    const { stdout } = await runGit(a, ["rev-list", "--count", "HEAD"]);
    assert.equal(stdout.trim(), "1");
  });

  it("commits a .gitignore covering engine scratch dirs", async () => {
    const dir = await getProjectDir("u3", "p3");
    const { stdout } = await runGit(dir, ["show", "HEAD:.gitignore"]);
    assert.match(stdout, /\.getokui\//);
  });
});

describe("ensureGitignore", () => {
  it("creates .gitignore when absent, is idempotent, and appends to a partial one", () => {
    const dir = mkdtempSync(join(tmpdir(), "gi-"));
    try {
      ensureGitignore(dir);
      const first = readFileSync(join(dir, ".gitignore"), "utf8");
      assert.match(first, /\.getokui\//);
      ensureGitignore(dir);
      assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), first);

      const dir2 = mkdtempSync(join(tmpdir(), "gi2-"));
      try {
        writeFileSync(join(dir2, ".gitignore"), "node_modules/\n");
        ensureGitignore(dir2);
        const merged = readFileSync(join(dir2, ".gitignore"), "utf8");
        assert.match(merged, /node_modules\//);
        assert.match(merged, /\.getokui\//);
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("commitPaths / rollbackDeliverable", { skip: GIT ? false : "git not available" }, () => {
  let tmpRoot: string;
  let prevRoot: string | undefined;

  before(() => {
    prevRoot = process.env.PROJECTS_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), "ws-commit-"));
    process.env.PROJECTS_ROOT = tmpRoot;
  });
  after(() => {
    if (prevRoot === undefined) delete process.env.PROJECTS_ROOT;
    else process.env.PROJECTS_ROOT = prevRoot;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("commits a changed file with subject + body, and no-ops on an empty diff", async () => {
    const dir = await getProjectDir("c1", "d1");
    writeFileSync(join(dir, "prd.md"), "# PRD v1\n");
    const first = await commitPaths(dir, ["prd.md"], { subject: "prd: generate", body: "Prompt: build X" });
    assert.equal(first.changed, true);
    assert.match(first.sha, /^[0-9a-f]{40}$/);

    const { stdout: subj } = await runGit(dir, ["log", "-1", "--format=%s"]);
    assert.equal(subj.trim(), "prd: generate");

    const again = await commitPaths(dir, ["prd.md"], { subject: "prd: generate" });
    assert.equal(again.changed, false);
    assert.equal(again.sha, first.sha);
  });

  it("rejects a traversal path before staging", async () => {
    const dir = await getProjectDir("c2", "d2");
    await assert.rejects(
      () => commitPaths(dir, ["../escape.md"], { subject: "x" }),
      ProjectPathError,
    );
  });

  it("rollbackDeliverable restores previous content as a NEW commit", async () => {
    const dir = await getProjectDir("c3", "d3");
    const file = join(dir, "prd.md");
    writeFileSync(file, "v1\n");
    await commitPaths(dir, ["prd.md"], { subject: "prd: v1" });
    writeFileSync(file, "v2\n");
    await commitPaths(dir, ["prd.md"], { subject: "prd: v2" });

    const before = await headSha(dir);
    const r = await rollbackDeliverable(dir, "prd.md", "previous");
    assert.equal(r.restored, true);
    assert.notEqual(r.sha, before);
    assert.equal(readFileSync(file, "utf8"), "v1\n");
    const { stdout: count } = await runGit(dir, ["rev-list", "--count", "HEAD"]);
    assert.equal(count.trim(), "4"); // init + v1 + v2 + rollback
  });
});
