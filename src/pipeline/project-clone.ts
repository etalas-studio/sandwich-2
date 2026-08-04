import { execFile } from "node:child_process";
import type { ProjectProvider } from "../db/project.js";

/**
 * Builds an HTTPS clone URL with the OAuth token embedded directly in the
 * userinfo portion — see docs/superpowers/specs/2026-08-04-project-selection-design.md
 * "Routes" section for why this (vs. a credential helper) was chosen.
 */
export function buildCloneUrl(
  provider: ProjectProvider,
  owner: string,
  repoSlug: string,
  token: string,
): string {
  if (provider === "github") {
    return `https://x-access-token:${token}@github.com/${owner}/${repoSlug}.git`;
  }
  return `https://x-token-auth:${token}@bitbucket.org/${owner}/${repoSlug}.git`;
}

export type ExecFn = (
  cmd: string,
  args: string[],
) => Promise<{ ok: true } | { ok: false; error: string }>;

export interface CloneResult {
  ok: boolean;
  error?: string;
}

/** Injectable exec (defaults to a real `git clone` via execFile) so tests never touch the network or filesystem. */
export async function cloneRepo(
  cloneUrl: string,
  targetDir: string,
  exec: ExecFn = defaultExec,
): Promise<CloneResult> {
  const result = await exec("git", ["clone", cloneUrl, targetDir]);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

function defaultExec(
  cmd: string,
  args: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5 * 60 * 1000 }, (err, _stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: stderr.toString().trim() || err.message });
        return;
      }
      resolve({ ok: true });
    });
  });
}
