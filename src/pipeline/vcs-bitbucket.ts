import type { VcsClient, VcsCreatePrInput, VcsFindPrInput, VcsOrg, VcsPrResult, VcsRepo, VcsRepoPage, FetchFn } from "./vcs-types.js";

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

      // Strategy 1: try /user/permissions/workspaces (includes name)
      let res = await fetchFn(`${API_BASE}/user/permissions/workspaces`, { headers });
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
      res = await fetchFn(`${API_BASE}/user/workspaces`, { headers });
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
      res = await fetchFn(`${API_BASE}/user`, { headers });
      if (res.ok) {
        const user = (await res.json()) as { username: string; display_name: string };
        return [{ slug: user.username, name: user.display_name, isPersonal: true }];
      }

      throw new Error("Bitbucket workspaces unavailable");
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

    async createPullRequest(input: VcsCreatePrInput): Promise<VcsPrResult> {
      const headers = {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      };
      const body = JSON.stringify({
        title: input.title,
        source: { branch: { name: input.headBranch } },
        destination: { branch: { name: input.baseBranch } },
        description: input.description ?? "",
      });
      const res = await fetchFn(
        `${API_BASE}/repositories/${input.owner}/${input.repoSlug}/pullrequests`,
        { method: "POST", headers, body },
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => "<unreadable>");
        throw new Error(`Bitbucket PR creation failed: ${res.status} — ${errBody.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        links: { html: { href: string } };
        id: number;
      };
      return { url: data.links.html.href, number: data.id };
    },

    async findPullRequest(input: VcsFindPrInput): Promise<VcsPrResult | null> {
      const headers = { Authorization: `Bearer ${input.token}` };
      const params = new URLSearchParams({ q: `source.branch.name="${input.headBranch}" AND state="OPEN"` });
      const res = await fetchFn(
        `${API_BASE}/repositories/${input.owner}/${input.repoSlug}/pullrequests?${params.toString()}`,
        { headers },
      );
      if (!res.ok) throw new Error(`Bitbucket PR lookup failed: ${res.status}`);
      const data = (await res.json()) as { values: Array<{ links: { html: { href: string } }; id: number }> };
      return data.values.length > 0
        ? { url: data.values[0]!.links.html.href, number: data.values[0]!.id }
        : null;
    },
  };
}
