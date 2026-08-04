import { strict as assert } from "node:assert";
import { createBitbucketVcsClient } from "./vcs-bitbucket.js";

function fakeResponse(body: unknown, opts: { status?: number } = {}) {
  return {
    ok: (opts.status ?? 200) < 400,
    status: opts.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

async function testListOrgsReturnsWorkspaces(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(url.startsWith("https://api.bitbucket.org/2.0/user/permissions/workspaces"));
    return fakeResponse({
      values: [
        { workspace: { slug: "acme", name: "Acme Inc" } },
        { workspace: { slug: "jane", name: "Jane Doe" } },
      ],
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const orgs = await client.listOrgs("test-token");

  assert.deepEqual(orgs, [
    { slug: "acme", name: "Acme Inc", isPersonal: false },
    { slug: "jane", name: "Jane Doe", isPersonal: false },
  ]);
  console.log("PASS: testListOrgsReturnsWorkspaces");
}

async function testListOrgsFallsBackToUserEndpoint(): Promise<void> {
  let callCount = 0;
  const fakeFetch = (async (url: string) => {
    callCount++;
    if (url.includes("/user/permissions/workspaces"))
      return fakeResponse({ values: [] }, { status: 410 });
    if (url.includes("/user/workspaces")) return fakeResponse({ values: [] }, { status: 410 });
    if (url.includes("/user")) {
      return fakeResponse({ username: "myuser", display_name: "My User" });
    }
    return fakeResponse({}, { status: 500 });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const orgs = await client.listOrgs("test-token");

  assert.deepEqual(orgs, [{ slug: "myuser", name: "My User", isPersonal: true }]);
  console.log("PASS: testListOrgsFallsBackToUserEndpoint");
}

async function testListReposForWorkspaceWithoutSearch(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(url.startsWith("https://api.bitbucket.org/2.0/repositories/acme"));
    return fakeResponse({
      values: [
        {
          name: "widgets",
          slug: "widgets",
          workspace: { slug: "acme" },
          mainbranch: { name: "main" },
        },
      ],
      next: "https://api.bitbucket.org/2.0/repositories/acme?page=2",
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1 });

  assert.deepEqual(page.repos, [{ owner: "acme", slug: "widgets", defaultBranch: "main" }]);
  assert.equal(page.nextPage, 2);
  console.log("PASS: testListReposForWorkspaceWithoutSearch");
}

async function testListReposHasNoNextPageWhenAbsent(): Promise<void> {
  const fakeFetch = (async () => {
    return fakeResponse({
      values: [
        { name: "solo", slug: "solo", workspace: { slug: "acme" }, mainbranch: { name: "main" } },
      ],
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1 });

  assert.equal(page.nextPage, null);
  console.log("PASS: testListReposHasNoNextPageWhenAbsent");
}

async function testListReposWithSearchQueryFiltersByName(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(url.includes("q="));
    assert.ok(url.includes("widg"));
    return fakeResponse({
      values: [
        {
          name: "widgets",
          slug: "widgets",
          workspace: { slug: "acme" },
          mainbranch: { name: "main" },
        },
      ],
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1, q: "widg" });

  assert.deepEqual(page.repos, [{ owner: "acme", slug: "widgets", defaultBranch: "main" }]);
  console.log("PASS: testListReposWithSearchQueryFiltersByName");
}

async function testCreatePullRequest(): Promise<void> {
  const fakeFetch = (async (url: string, init?: { method?: string; body?: string }) => {
    assert.ok(
      url.startsWith("https://api.bitbucket.org/2.0/repositories/acme/widgets/pullrequests"),
    );
    assert.equal(init?.method, "POST");
    const body = JSON.parse(init?.body ?? "{}");
    assert.equal(body.title, "Fix: test");
    assert.equal(body.source.branch.name, "feature-branch");
    assert.equal(body.destination.branch.name, "main");
    return fakeResponse({
      links: { html: { href: "https://bitbucket.org/acme/widgets/pull-requests/7" } },
      id: 7,
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const pr = await client.createPullRequest({
    token: "test-token",
    owner: "acme",
    repoSlug: "widgets",
    title: "Fix: test",
    headBranch: "feature-branch",
    baseBranch: "main",
    description: "PR body",
  });
  assert.deepEqual(pr, { url: "https://bitbucket.org/acme/widgets/pull-requests/7", number: 7 });
  console.log("PASS: testCreatePullRequest");
}

async function testFindPullRequestReturnsExistingOpenPr(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(
      url.startsWith("https://api.bitbucket.org/2.0/repositories/acme/widgets/pullrequests"),
    );
    assert.ok(url.includes("feature-branch"));
    return fakeResponse({
      values: [
        { links: { html: { href: "https://bitbucket.org/acme/widgets/pull-requests/3" } }, id: 3 },
      ],
    });
  }) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const pr = await client.findPullRequest({
    token: "test-token",
    owner: "acme",
    repoSlug: "widgets",
    headBranch: "feature-branch",
  });
  assert.deepEqual(pr, { url: "https://bitbucket.org/acme/widgets/pull-requests/3", number: 3 });
  console.log("PASS: testFindPullRequestReturnsExistingOpenPr");
}

async function testFindPullRequestReturnsNullWhenNoneOpen(): Promise<void> {
  const fakeFetch = (async () => fakeResponse({ values: [] })) as typeof fetch;

  const client = createBitbucketVcsClient(fakeFetch);
  const pr = await client.findPullRequest({
    token: "test-token",
    owner: "acme",
    repoSlug: "widgets",
    headBranch: "feature-branch",
  });
  assert.equal(pr, null);
  console.log("PASS: testFindPullRequestReturnsNullWhenNoneOpen");
}

async function main(): Promise<void> {
  await testListOrgsReturnsWorkspaces();
  await testListOrgsFallsBackToUserEndpoint();
  await testListReposForWorkspaceWithoutSearch();
  await testListReposHasNoNextPageWhenAbsent();
  await testListReposWithSearchQueryFiltersByName();
  await testCreatePullRequest();
  await testFindPullRequestReturnsExistingOpenPr();
  await testFindPullRequestReturnsNullWhenNoneOpen();
}

main();
