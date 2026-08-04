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

async function tryFetch(fetchFn: FetchFn, token: string, path: string): Promise<Response> {
  const res = await fetchFn(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>");
    console.error(`Bitbucket ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}

export function createBitbucketVcsClient(fetchFn: FetchFn): VcsClient {
  return {
    async listOrgs(token: string): Promise<VcsOrg[]> {
      // Strategy 1: try /user/permissions/workspaces (includes name)
      let res = await tryFetch(fetchFn, token, "/user/permissions/workspaces");
      if (res.ok) {
        const body = (await res.json()) as {
          values: Array<{ workspace: { slug: string; name: string } }>;
        };
        return body.values.map((m) => ({
          slug: m.workspace.slug,
          name: m.workspace.name,
          isPersonal: false,
        }));
      }

      // Strategy 2: try /user/workspaces (no name field, use slug)
      res = await tryFetch(fetchFn, token, "/user/workspaces");
      if (res.ok) {
        const body = (await res.json()) as {
          values: Array<{ workspace: { slug: string } }>;
        };
        return body.values.map((m) => ({
          slug: m.workspace.slug,
          name: m.workspace.slug,
          isPersonal: false,
        }));
      }

      // Strategy 3: get /user to find the account's own workspace slug
      res = await tryFetch(fetchFn, token, "/user");
      if (res.ok) {
        const user = (await res.json()) as { username: string; display_name: string };
        return [{ slug: user.username, name: user.display_name, isPersonal: true }];
      }

      throw new Error("All Bitbucket workspace endpoints failed — check server logs for details");
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
