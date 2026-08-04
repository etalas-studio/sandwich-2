import type { VcsClient, VcsOrg, VcsRepo, VcsRepoPage, FetchFn } from "./vcs-types.js";

const API_BASE = "https://api.bitbucket.org/2.0";

interface BitbucketRepoResponse {
  name: string;
  slug: string;
  workspace: { slug: string };
  mainbranch: { name: string } | null;
}

function toRepo(r: BitbucketRepoResponse): VcsRepo {
  return { owner: r.workspace.slug, slug: r.slug, defaultBranch: r.mainbranch?.name ?? "main" };
}

/** Bitbucket paginates via a `next` URL in the response body (not a Link
 * header like GitHub) — extracts just the `page` query param callers need. */
function nextPageFromNextUrl(nextUrl: string | undefined): number | null {
  if (!nextUrl) return null;
  const match = nextUrl.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function createBitbucketVcsClient(fetchFn: FetchFn): VcsClient {
  return {
    async listOrgs(token: string): Promise<VcsOrg[]> {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetchFn(`${API_BASE}/workspaces`, { headers });
      if (!res.ok) throw new Error(`Bitbucket /workspaces failed: ${res.status}`);
      const body = (await res.json()) as { values: Array<{ slug: string; name: string }> };
      return body.values.map((w) => ({ slug: w.slug, name: w.name, isPersonal: false }));
    },

    async listRepos(token: string, org: string, opts: { page: number; q?: string }): Promise<VcsRepoPage> {
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams({ page: String(opts.page), pagelen: "30" });
      if (opts.q) params.set("q", `name~"${opts.q}"`);

      const res = await fetchFn(`${API_BASE}/repositories/${org}?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`Bitbucket repos failed: ${res.status}`);
      const body = (await res.json()) as { values: BitbucketRepoResponse[]; next?: string };
      return { repos: body.values.map(toRepo), nextPage: nextPageFromNextUrl(body.next) };
    },
  };
}
