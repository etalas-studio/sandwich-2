import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
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
  constructor(args: readonly string[], stderr: string) {
    super(`git ${args.join(" ")} failed: ${stderr.trim() || "(no stderr)"}`);
    this.name = "ProjectGitError";
    this.args = args;
    this.stderr = stderr;
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

/** Reject a path segment that isn't a single safe directory name. */
function assertSafeSegment(value: string, label: string): void {
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
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { stdout, stderr };
  } catch (err) {
    const stderr =
      typeof err === "object" && err && "stderr" in err
        ? String((err as { stderr: unknown }).stderr)
        : String(err);
    throw new ProjectGitError(args, stderr);
  }
}

function isInitialised(dir: string): boolean {
  return existsSync(join(dir, ".git", "HEAD"));
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
      // `-c init.defaultBranch=main` works on every git version; the
      // `--initial-branch` flag needs >= 2.28. `--template=` skips the system
      // template dir (sample hooks, or real hooks from a custom templateDir).
      await runGit(dir, ["-c", "init.defaultBranch=main", "init", "--template="]);
      await runGit(dir, ["config", "user.name", GIT_AUTHOR_NAME]);
      await runGit(dir, ["config", "user.email", GIT_AUTHOR_EMAIL]);
      await runGit(dir, ["commit", "--allow-empty", "-m", "chore: initialise project workspace"]);
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
