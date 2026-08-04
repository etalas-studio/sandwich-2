import { strict as assert } from "node:assert";
import { createGithubVcsClient } from "./vcs-github.js";

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers: { get: (name: string) => string | null };
}

function fakeResponse(body: unknown, opts: { status?: number; link?: string } = {}): FakeResponse {
  return {
    ok: (opts.status ?? 200) < 400,
    status: opts.status ?? 200,
    json: async () => body,
    headers: { get: (name: string) => (name.toLowerCase() === "link" ? opts.link ?? null : null) },
  };
}

async function testListOrgsReturnsPersonalAccountAndOrgs(): Promise<void> {
  const calls: string[] = [];
  const fakeFetch = (async (url: string) => {
    calls.push(url);
    if (url === "https://api.github.com/user") {
      return fakeResponse({ login: "jane" }) as unknown as Response;
    }
    if (url === "https://api.github.com/user/orgs") {
      return fakeResponse([
        { login: "acme" },
        { login: "widgets-inc" },
      ]) as unknown as Response;
    }
    throw new Error(`unexpected url: ${url}`);
  }) as typeof fetch;

  const client = createGithubVcsClient(fakeFetch);
  const orgs = await client.listOrgs("test-token");

  assert.deepEqual(orgs, [
    { slug: "jane", name: "jane", isPersonal: true },
    { slug: "acme", name: "acme", isPersonal: false },
    { slug: "widgets-inc", name: "widgets-inc", isPersonal: false },
  ]);
  assert.ok(calls.includes("https://api.github.com/user"));
  assert.ok(calls.includes("https://api.github.com/user/orgs"));
  console.log("PASS: testListOrgsReturnsPersonalAccountAndOrgs");
}

async function testListReposForOrgWithoutSearch(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(url.startsWith("https://api.github.com/orgs/acme/repos"));
    assert.ok(url.includes("page=1"));
    return fakeResponse([
      { name: "widgets", owner: { login: "acme" }, default_branch: "main" },
      { name: "gadgets", owner: { login: "acme" }, default_branch: "trunk" },
    ], { link: '<https://api.github.com/orgs/acme/repos?page=2>; rel="next"' }) as unknown as Response;
  }) as typeof fetch;

  const client = createGithubVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1 });

  assert.deepEqual(page.repos, [
    { owner: "acme", slug: "widgets", defaultBranch: "main" },
    { owner: "acme", slug: "gadgets", defaultBranch: "trunk" },
  ]);
  assert.equal(page.nextPage, 2);
  console.log("PASS: testListReposForOrgWithoutSearch");
}

async function testListReposHasNoNextPageWhenLinkHeaderMissing(): Promise<void> {
  const fakeFetch = (async () => {
    return fakeResponse([{ name: "solo", owner: { login: "acme" }, default_branch: "main" }]) as unknown as Response;
  }) as typeof fetch;

  const client = createGithubVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1 });

  assert.equal(page.nextPage, null);
  console.log("PASS: testListReposHasNoNextPageWhenLinkHeaderMissing");
}

async function testListReposWithSearchQueryUsesSearchEndpoint(): Promise<void> {
  const fakeFetch = (async (url: string) => {
    assert.ok(url.startsWith("https://api.github.com/search/repositories"));
    assert.ok(url.includes("org%3Aacme"));
    assert.ok(url.includes("widg"));
    return fakeResponse({
      items: [{ name: "widgets", owner: { login: "acme" }, default_branch: "main" }],
    }) as unknown as Response;
  }) as typeof fetch;

  const client = createGithubVcsClient(fakeFetch);
  const page = await client.listRepos("test-token", "acme", { page: 1, q: "widg" });

  assert.deepEqual(page.repos, [{ owner: "acme", slug: "widgets", defaultBranch: "main" }]);
  console.log("PASS: testListReposWithSearchQueryUsesSearchEndpoint");
}

async function main(): Promise<void> {
  await testListOrgsReturnsPersonalAccountAndOrgs();
  await testListReposForOrgWithoutSearch();
  await testListReposHasNoNextPageWhenLinkHeaderMissing();
  await testListReposWithSearchQueryUsesSearchEndpoint();
}

main();
