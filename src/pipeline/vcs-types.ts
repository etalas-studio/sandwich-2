/**
 * Provider-agnostic shape for listing orgs/workspaces and repos, backing
 * GET /api/projects/orgs and GET /api/projects/repos (see
 * docs/superpowers/specs/2026-08-04-project-selection-design.md).
 * One implementation per provider: vcs-github.ts, vcs-bitbucket.ts.
 */

export interface VcsOrg {
  slug: string;
  name: string;
  isPersonal: boolean;
}

export interface VcsRepo {
  owner: string;
  slug: string;
  defaultBranch: string;
}

export interface VcsRepoPage {
  repos: VcsRepo[];
  nextPage: number | null;
}

export interface VcsClient {
  listOrgs(token: string): Promise<VcsOrg[]>;
  listRepos(token: string, org: string, opts: { page: number; q?: string }): Promise<VcsRepoPage>;
}

/** Injectable in tests, defaults to the global fetch in production. */
export type FetchFn = typeof fetch;
