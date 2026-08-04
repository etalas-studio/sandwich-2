import type { VcsClient, VcsOrg, VcsRepo, VcsRepoPage, FetchFn } from "./vcs-types.js";

const API_BASE = "https://api.github.com";

interface GithubRepoResponse {
  name: string;
  owner: { login: string };
  default_branch: string;
}

function toRepo(r: GithubRepoResponse): VcsRepo {
  return { owner: r.owner.login, slug: r.name, defaultBranch: r.default_branch };
}

/** Parses the `page=N` value out of the `rel="next"` entry of a GitHub Link header, if present. */
function nextPageFromLinkHeader(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const nextEntry = linkHeader.split(",").find((part) => part.includes('rel="next"'));
  if (!nextEntry) return null;
  const match = nextEntry.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function createGithubVcsClient(fetchFn: FetchFn): VcsClient {
  let personalLogin: string | null = null;

  return {
    async listOrgs(token: string): Promise<VcsOrg[]> {
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

      const userRes = await fetchFn(`${API_BASE}/user`, { headers });
      if (!userRes.ok) throw new Error(`GitHub /user failed: ${userRes.status}`);
      const user = (await userRes.json()) as { login: string };
      personalLogin = user.login;

      const orgsRes = await fetchFn(`${API_BASE}/user/orgs`, { headers });
      if (!orgsRes.ok) throw new Error(`GitHub /user/orgs failed: ${orgsRes.status}`);
      const orgs = (await orgsRes.json()) as Array<{ login: string }>;

      return [
        { slug: user.login, name: user.login, isPersonal: true },
        ...orgs.map((o) => ({ slug: o.login, name: o.login, isPersonal: false })),
      ];
    },

    async listRepos(token: string, org: string, opts: { page: number; q?: string }): Promise<VcsRepoPage> {
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

      if (opts.q) {
        const params = new URLSearchParams({
          q: `${opts.q} org:${org}`,
          page: String(opts.page),
        });
        const res = await fetchFn(`${API_BASE}/search/repositories?${params.toString()}`, { headers });
        if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
        const body = (await res.json()) as { items: GithubRepoResponse[] };
        return { repos: body.items.map(toRepo), nextPage: null };
      }

      const reposPath = org === personalLogin ? "/user/repos" : `/orgs/${org}/repos`;
      const params = new URLSearchParams({ page: String(opts.page), per_page: "30", type: "all" });
      const res = await fetchFn(`${API_BASE}${reposPath}?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`GitHub repos failed: ${res.status}`);
      const body = (await res.json()) as GithubRepoResponse[];
      return { repos: body.map(toRepo), nextPage: nextPageFromLinkHeader(res.headers.get("link")) };
    },
  };
}
