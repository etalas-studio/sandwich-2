import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "./proc.js";
import type { DiffStat, DiffSummary } from "./types.js";

const GIT_TIMEOUT_MS = 120_000;

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await exec("git", args, { cwd, timeoutMs: GIT_TIMEOUT_MS });
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} gagal (exit ${String(result.exitCode)})\n${result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

export async function assertCleanRepo(repoPath: string): Promise<void> {
  // Cek staged/modified files saja, ignore untracked.
  // Untracked biasanya artifact/temporary, bukan kerjaan aktif.
  const result = await exec("git", ["diff-index", "--quiet", "HEAD", "--"], {
    cwd: repoPath,
    timeoutMs: GIT_TIMEOUT_MS,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Repo ${repoPath} punya perubahan yang belum di-commit.\n` +
        `Orchestrator menolak jalan supaya tidak mencampur kerjaan manusia dengan kerjaan agent.`,
    );
  }
}

export async function resolveBaseCommit(
  repoPath: string,
  baseBranch: string,
): Promise<string> {
  const out = await git(repoPath, ["rev-parse", baseBranch]);
  return out.trim();
}

export interface Worktree {
  path: string;
  branch: string;
  baseCommit: string;
}

/**
 * Satu tiket, satu worktree. Worktree adalah checkout terpisah di folder sendiri
 * yang berbagi database git yang sama — jadi percobaan tidak saling tabrakan dan
 * repo utama tidak pernah kesentuh.
 */
export async function createWorktree(
  repoPath: string,
  worktreeRoot: string,
  branch: string,
  baseBranch: string,
): Promise<Worktree> {
  mkdirSync(worktreeRoot, { recursive: true });

  const safeName = branch.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = join(worktreeRoot, safeName);

  if (existsSync(path)) {
    throw new Error(
      `Worktree sudah ada: ${path}\n` +
        `Hapus dulu dengan: git -C ${repoPath} worktree remove ${path} --force`,
    );
  }

  const baseCommit = await resolveBaseCommit(repoPath, baseBranch);
  await git(repoPath, ["worktree", "add", "-b", branch, path, baseCommit]);

  return { path, branch, baseCommit };
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  keepBranch: boolean,
): Promise<void> {
  await exec("git", ["worktree", "remove", worktreePath, "--force"], {
    cwd: repoPath,
    timeoutMs: GIT_TIMEOUT_MS,
  });

  if (!keepBranch) {
    await exec("git", ["branch", "-D", branch], {
      cwd: repoPath,
      timeoutMs: GIT_TIMEOUT_MS,
    });
  }
}

/**
 * Ringkas perubahan di worktree terhadap commit dasar.
 * Termasuk file yang belum di-stage, karena agent tidak wajib commit.
 */
export async function summarizeDiff(
  worktreePath: string,
  baseCommit: string,
): Promise<DiffSummary> {
  await exec("git", ["add", "-A"], { cwd: worktreePath, timeoutMs: GIT_TIMEOUT_MS });

  const numstat = await git(worktreePath, [
    "diff",
    "--numstat",
    "--staged",
    baseCommit,
  ]);

  const stats: DiffStat[] = [];
  for (const line of numstat.split("\n")) {
    if (line.trim().length === 0) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const added = Number.parseInt(parts[0] ?? "0", 10);
    const removed = Number.parseInt(parts[1] ?? "0", 10);
    const file = (parts[2] ?? "").trim();
    if (file.length === 0) continue;
    stats.push({
      file,
      added: Number.isNaN(added) ? 0 : added,
      removed: Number.isNaN(removed) ? 0 : removed,
    });
  }

  const nameStatus = await git(worktreePath, [
    "diff",
    "--name-status",
    "--staged",
    baseCommit,
  ]);

  const addedTestFiles: string[] = [];
  for (const line of nameStatus.split("\n")) {
    if (line.trim().length === 0) continue;
    const [status, ...rest] = line.split("\t");
    const file = (rest[rest.length - 1] ?? "").trim();
    if (status === "A" && /^spec\/.+_spec\.rb$/.test(file)) {
      addedTestFiles.push(file);
    }
  }

  const patch = await git(worktreePath, ["diff", "--staged", baseCommit]);

  const diffLines = stats.reduce((sum, s) => sum + s.added + s.removed, 0);

  return {
    stats,
    filesChanged: stats.length,
    diffLines,
    addedTestFiles,
    patch,
  };
}

export async function pushBranch(
  worktreePath: string,
  branch: string,
): Promise<void> {
  await git(worktreePath, ["push", "--set-upstream", "origin", branch]);
}

export async function commitAll(
  worktreePath: string,
  message: string,
): Promise<void> {
  await exec("git", ["add", "-A"], { cwd: worktreePath, timeoutMs: GIT_TIMEOUT_MS });
  const result = await exec("git", ["commit", "-m", message], {
    cwd: worktreePath,
    timeoutMs: GIT_TIMEOUT_MS,
  });
  // exit 1 dengan "nothing to commit" bukan error yang perlu menghentikan alur.
  if (result.exitCode !== 0 && !/nothing to commit/i.test(result.stdout)) {
    throw new Error(`git commit gagal:\n${result.stderr.trim()}`);
  }
}
