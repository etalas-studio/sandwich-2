import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectPathReason = "invalid" | "absolute" | "traversal" | "symlink";

/** Thrown by the path guard when a relative path would escape the project dir. */
export class ProjectPathError extends Error {
  readonly reason: ProjectPathReason;
  constructor(reason: ProjectPathReason, message: string) {
    super(message);
    this.name = "ProjectPathError";
    this.reason = reason;
  }
}

/** Thrown when a `git` invocation exits non-zero. */
export class ProjectGitError extends Error {
  readonly args: readonly string[];
  readonly stderr: string;
  readonly code: number | string | null;
  constructor(
    args: readonly string[],
    detail: { stderr?: string; stdout?: string; code?: number | string | null; message?: string },
  ) {
    const parts = [
      detail.stderr?.trim(),
      detail.stdout?.trim(),
      detail.code != null ? `exit=${detail.code}` : undefined,
      detail.message,
    ].filter(Boolean);
    super(`git ${args.join(" ")} failed: ${parts.join(" | ") || "(no output)"}`);
    this.name = "ProjectGitError";
    this.args = args;
    this.stderr = detail.stderr ?? "";
    this.code = detail.code ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deliverable layout — the single source of truth for on-disk filenames, so
// M2 (write deliverables), M3 (commit/rollback) and M4 (file-tree, preview)
// don't each invent their own mapping.
// ─────────────────────────────────────────────────────────────────────────────

export const BRIEF_FILE = "BRIEF.md";

export const DELIVERABLE_FILES = {
  prd: "prd.md",
  quotation: "quotation.md",
  specs: "spec.md",
  mom: "mom.md",
  prototype: "prototype/index.html",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// git identity — a container has no ~/.gitconfig, so `git commit` fails with
// "Please tell me who you are" unless we supply an identity. Set it both as
// repo-local config (survives for M3's commits) and as env vars on every call
// (survives a repo restored from an R2 bundle at M5-02).
// ─────────────────────────────────────────────────────────────────────────────

const GIT_AUTHOR_NAME = "SANDWICH";
const GIT_AUTHOR_EMAIL = "bot@sandwich.local";

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS_ROOT resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The root under which every project directory lives. Read from the environment
 * on every call (never cached) so tests can repoint it per-case.
 *
 *   PROJECTS_ROOT env var, else
 *   /data/projects            in production (Railway Volume mount)
 *   <repo>/data/projects      in dev (git-ignored via the existing `data/` rule)
 */
export function projectsRoot(): string {
  const fromEnv = process.env.PROJECTS_ROOT?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "/data/projects";
  return resolve(process.cwd(), "data/projects");
}

/**
 * Reject a path segment that isn't a single safe directory name. Exported —
 * userId / projectId / conversationId all flow into filesystem paths.
 */
export function assertSafeSegment(value: string, label: string): void {
  if (
    !value ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new ProjectPathError("invalid", `unsafe ${label} segment: ${JSON.stringify(value)}`);
  }
}

/** Pure path composition — no filesystem access. Validates both id segments. */
export function projectDirPath(userId: string, projectId: string): string {
  assertSafeSegment(userId, "userId");
  assertSafeSegment(projectId, "projectId");
  return join(projectsRoot(), userId, projectId);
}

// ─────────────────────────────────────────────────────────────────────────────
// git
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs `git` in `cwd`. Exported because M3 (commit / rollback / log / diff) and
 * M5-01 (git bundle) all need it — one wrapper, one place that gets the
 * identity env right.
 */
export async function runGit(
  cwd: string,
  args: readonly string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args as string[], {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME,
        GIT_AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: GIT_AUTHOR_NAME,
        GIT_COMMITTER_EMAIL: GIT_AUTHOR_EMAIL,
        // Deterministic behaviour regardless of the host's global/system config.
        // Empty string = "no file" and avoids the "/dev/null is not a regular
        // file" errors some git builds emit.
        GIT_CONFIG_GLOBAL: "",
        GIT_CONFIG_SYSTEM: "",
        GIT_TERMINAL_PROMPT: "0",
        // A writable HOME so git never fails statting ~ (containers may not set it).
        HOME: process.env.HOME || cwd,
      },
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { stdout, stderr };
  } catch (err) {
    const e = (err ?? {}) as {
      stderr?: unknown;
      stdout?: unknown;
      code?: number | string | null;
      message?: string;
    };
    throw new ProjectGitError(args, {
      stderr: e.stderr != null ? String(e.stderr) : undefined,
      stdout: e.stdout != null ? String(e.stdout) : undefined,
      code: e.code ?? null,
      message: e.message,
    });
  }
}

function isInitialised(dir: string): boolean {
  return existsSync(join(dir, ".git", "HEAD"));
}

// Scratch dirs the engines write into `cwd` (reference styles, getokui library,
// pi internals, logs). They must never be committed — a committed `.getokui/`
// bloats every project repo permanently.
const GITIGNORE_ENTRIES = [
  "# SANDWICH — engine scratch, never committed",
  ".getokui/",
  ".reference/",
  ".pi/",
  "*.log",
  "",
];

/**
 * Ensures the project has a `.gitignore` covering engine scratch dirs. Idempotent
 * and cheap — called on `getProjectDir` init and healed on every resolve so
 * repos created before this existed pick it up.
 */
export function ensureGitignore(projectDir: string): void {
  const path = resolveInsideProject(projectDir, ".gitignore");
  const wanted = GITIGNORE_ENTRIES.join("\n");
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8");
    if (current.includes(".getokui/")) return;
    writeFileSync(path, current.replace(/\n*$/, "\n") + "\n" + wanted, "utf8");
    return;
  }
  writeFileSync(path, wanted, "utf8");
}

// In-process guard so two concurrent getProjectDir calls for the same project
// don't both run `git init`. Covers the single-instance deployment (M1-04);
// M2-06 / M5-02 add the real cross-request lock.
const initInFlight = new Map<string, Promise<string>>();

/**
 * Resolves `${PROJECTS_ROOT}/${userId}/${projectId}`, creating the directory,
 * running `git init` and an initial empty commit on first call. Idempotent.
 */
export function getProjectDir(userId: string, projectId: string): Promise<string> {
  const dir = projectDirPath(userId, projectId);
  if (isInitialised(dir)) return Promise.resolve(dir);

  const key = `${userId}/${projectId}`;
  const existing = initInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    if (!isInitialised(dir)) {
      mkdirSync(dir, { recursive: true });
      // `-c init.defaultBranch=main` works on every git version (the
      // `--initial-branch` flag needs >= 2.28). No `--template=` — an empty
      // template path is rejected by some git builds; the default sample hooks
      // it would have avoided are inert anyway.
      await runGit(dir, ["-c", "init.defaultBranch=main", "init", "-q"]);
      await runGit(dir, ["config", "--local", "user.name", GIT_AUTHOR_NAME]);
      await runGit(dir, ["config", "--local", "user.email", GIT_AUTHOR_EMAIL]);
      ensureGitignore(dir);
      await runGit(dir, ["add", "--", ".gitignore"]);
      await runGit(dir, ["commit", "-q", "-m", "chore: initialise project workspace"]);
    } else {
      ensureGitignore(dir);
    }
    return dir;
  })().finally(() => initInFlight.delete(key));

  initInFlight.set(key, task);
  return task;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves `relPath` against an already-resolved project directory, guaranteeing
 * the result stays inside it. Throws `ProjectPathError` on any escape.
 *
 * Takes the resolved dir (not projectId) so it's a pure function of two strings
 * — no env var, no DB round-trip to recover userId. Compose with getProjectDir:
 *
 *     const dir = await getProjectDir(userId, projectId);
 *     const file = resolveInsideProject(dir, DELIVERABLE_FILES.prd);
 */
export function resolveInsideProject(projectDir: string, relPath: string): string {
  if (typeof relPath !== "string" || relPath === "" || relPath.includes("\0")) {
    throw new ProjectPathError("invalid", `invalid relative path: ${JSON.stringify(relPath)}`);
  }

  // Absolute paths, including Windows-style ones that path.isAbsolute misses on
  // POSIX (a model-generated tool call could emit "C:\..." or "\\server\...").
  if (isAbsolute(relPath) || /^[a-zA-Z]:[\\/]/.test(relPath) || /^\\\\/.test(relPath)) {
    throw new ProjectPathError("absolute", `absolute path not allowed: ${relPath}`);
  }

  // Explicit ".." — step 4 would also catch escapes, but this gives a precise
  // error and rejects "a/../b" style paths outright.
  if (relPath.split(/[/\\]+/).some((seg) => seg === "..")) {
    throw new ProjectPathError("traversal", `path traversal not allowed: ${relPath}`);
  }

  const root = resolve(projectDir);
  const target = resolve(root, relPath);

  // The `+ sep` matters: a bare startsWith accepts "<root>-evil" for "<root>".
  if (target !== root && !target.startsWith(root + sep)) {
    throw new ProjectPathError("traversal", `path escapes project dir: ${relPath}`);
  }

  // Symlink escape. realpath the target — but it may not exist yet on a write
  // path, so walk up to the deepest existing ancestor, realpath that, and
  // re-append the non-existent tail. The root MUST be realpath'd too: on macOS
  // mkdtemp(tmpdir()) yields /var/folders/... which is a symlink to /private/...
  const realRoot = realpathSync(root);
  let probe = target;
  while (!existsSync(probe) && probe !== dirname(probe)) probe = dirname(probe);
  const realTarget = resolve(realpathSync(probe), relative(probe, target));
  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) {
    throw new ProjectPathError("symlink", `path escapes project dir via symlink: ${relPath}`);
  }

  // Return the logical path (rooted at projectDir), not the realpath'd one.
  return target;
}

/** The path guard without the return value — for callers that only need the check. */
export function assertInsideProject(projectDir: string, relPath: string): void {
  resolveInsideProject(projectDir, relPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Commits (minimal M3-01 — M3 adds history / diff / ordinal rollback / R2)
// ─────────────────────────────────────────────────────────────────────────────

export interface CommitMessage {
  subject: string;
  body?: string;
}

export interface CommitResult {
  sha: string;
  /** false when the staged diff was empty — no commit was made. */
  changed: boolean;
}

/** The current HEAD sha. */
export async function headSha(projectDir: string): Promise<string> {
  const { stdout } = await runGit(projectDir, ["rev-parse", "HEAD"]);
  return stdout.trim();
}

/**
 * Stages `relPaths` and commits them. An empty staged diff produces no commit
 * and returns `{ changed: false, sha: <current HEAD> }` — the caller replies
 * "nothing changed" (M3-01 acceptance criterion).
 *
 * Every path is run through the guard before it reaches `git add` — a
 * model-supplied path must never escape the project dir.
 */
export async function commitPaths(
  projectDir: string,
  relPaths: readonly string[],
  message: CommitMessage,
): Promise<CommitResult> {
  const safe = relPaths.map((p) => {
    resolveInsideProject(projectDir, p);
    return p;
  });
  if (safe.length === 0) return { changed: false, sha: await headSha(projectDir) };

  await runGit(projectDir, ["add", "--", ...safe]);

  // Not `--quiet`: runGit throws on any non-zero exit, and `--quiet` signals
  // "differences exist" with exit 1. Test for empty stdout instead.
  const { stdout: staged } = await runGit(projectDir, [
    "diff",
    "--cached",
    "--name-only",
  ]);
  if (staged.trim() === "") {
    return { changed: false, sha: await headSha(projectDir) };
  }

  const args = ["commit", "-m", message.subject];
  if (message.body) args.push("-m", message.body);
  await runGit(projectDir, args);
  return { changed: true, sha: await headSha(projectDir) };
}

/**
 * Restores one deliverable file to a previous state and commits the restore
 * (never rewrites history).
 *
 *   "previous" → the file as of the commit before the one that last touched it
 *   "latest"   → the file as of the most recent commit that touched it (undo
 *                uncommitted local edits — rare, but matches today's semantics)
 *
 * Ordinal rollback ("v2"), cross-deliverable restore, history and diff are M3.
 */
export async function rollbackDeliverable(
  projectDir: string,
  relPath: string,
  intent: "previous" | "latest",
): Promise<{ sha: string; restored: boolean }> {
  resolveInsideProject(projectDir, relPath);

  const { stdout: log } = await runGit(projectDir, [
    "log",
    "--format=%H",
    "--",
    relPath,
  ]);
  const commits = log.split("\n").map((l) => l.trim()).filter(Boolean);
  if (commits.length === 0) return { sha: await headSha(projectDir), restored: false };

  // commits[0] = most recent touch. "previous" wants the one before it.
  const ref = intent === "latest" ? commits[0]! : commits[1];
  if (!ref) return { sha: await headSha(projectDir), restored: false };

  await runGit(projectDir, ["checkout", ref, "--", relPath]);
  const result = await commitPaths(projectDir, [relPath], {
    subject: `${relPath}: rollback (${intent})`,
    body: `Restored from ${ref.slice(0, 12)}`,
  });
  return { sha: result.sha, restored: result.changed };
}
