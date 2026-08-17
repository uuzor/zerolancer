import { test } from "node:test";
import assert from "node:assert/strict";
import { GithubClient, parseRepoRef } from "./client.js";
import { getGithubStore } from "./store.js";

const PAT = process.env.ZERO_GITHUB_TOKEN;
const hasPat = Boolean(PAT && PAT.length > 10);

function live(name: string, fn: () => Promise<void>): void {
  if (hasPat) {
    test(name, fn);
  } else {
    test(name, { skip: true }, fn);
  }
}

live("live: getUser returns authenticated user", async () => {
  const gh = new GithubClient({ pat: PAT });
  const user = await gh.getUser(PAT!);
  assert.ok(user.login, "login should be present");
  assert.ok(user.id > 0, "id should be positive");
  assert.equal(typeof user.htmlUrl, "string");
});

live("live: listRepos returns at least one repo", async () => {
  const gh = new GithubClient({ pat: PAT });
  const repos = await gh.listRepos(PAT!, { affiliation: "owner,collaborator", perPage: 5 });
  assert.ok(repos.length > 0, "should have at least one repo");
  const first = repos[0]!;
  assert.ok(first.owner, "repo should have owner");
  assert.ok(first.name, "repo should have name");
  assert.ok(first.fullName, "repo should have fullName");
  assert.ok(first.htmlUrl.startsWith("https://github.com/"), "htmlUrl should be valid");
  assert.equal(typeof first.private, "boolean");
  assert.ok(first.defaultBranch, "repo should have defaultBranch");
});

live("live: getRepo fetches specific repo", async () => {
  const gh = new GithubClient({ pat: PAT });
  const repos = await gh.listRepos(PAT!, { perPage: 1 });
  const first = repos[0]!;
  const repo = await gh.getRepo(PAT!, first.owner, first.name);
  assert.equal(repo.owner, first.owner);
  assert.equal(repo.name, first.name);
  assert.ok(repo.cloneUrl, "should have cloneUrl");
});

live("live: getRepo throws on non-existent repo", async () => {
  const gh = new GithubClient({ pat: PAT });
  await assert.rejects(
    () => gh.getRepo(PAT!, "uuzor", "this-repo-does-not-exist-xyz-123"),
    /404|not found/i,
  );
});

live("live: listPullRequests returns array", async () => {
  const gh = new GithubClient({ pat: PAT });
  const repos = await gh.listRepos(PAT!, { perPage: 10 });
  const withPrs = repos.filter((r) => !r.private);
  if (withPrs.length === 0) return;
  const repo = withPrs[0]!;
  const prs = await gh.listPullRequests(PAT!, repo.owner, repo.name, "all");
  assert.ok(Array.isArray(prs), "should return array");
});

live("live: connect + query repo through store", async () => {
  const gh = new GithubClient({ pat: PAT });
  const store = getGithubStore();
  const repos = await gh.listRepos(PAT!, { perPage: 1 });
  const first = repos[0]!;

  store.connectRepo({
    taskId: 10001n,
    owner: first.owner,
    repo: first.name,
    issueNumber: null,
    connectedBy: "test-user",
    connectedAt: new Date().toISOString(),
    prNumber: null,
    prBranch: null,
  });

  const conn = store.getConnection(10001n);
  assert.ok(conn);
  assert.equal(conn?.owner, first.owner);
  assert.equal(conn?.repo, first.name);
  assert.equal(conn?.connectedBy, "test-user");

  store.removeConnection(10001n);
  assert.equal(store.getConnection(10001n), undefined);
});

live("live: parseRepoRef on real repo URL", async () => {
  const gh = new GithubClient({ pat: PAT });
  const repos = await gh.listRepos(PAT!, { perPage: 1 });
  const first = repos[0]!;
  const ref = parseRepoRef(first.htmlUrl);
  assert.ok(ref);
  assert.equal(ref?.owner, first.owner);
  assert.equal(ref?.repo, first.name);
});

live("live: PAT fallback works when no OAuth token provided", async () => {
  const gh = new GithubClient({ pat: PAT });
  const user = await gh.getUser(PAT!);
  assert.ok(user.login);
});
