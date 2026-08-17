/**
 * HTTP-level integration tests for the GitHub REST endpoints.
 *
 * Prerequisites:
 *   - Backend server running on ZERO_PORT (default 3000)
 *   - ZERO_GITHUB_TOKEN env var set (a GitHub PAT)
 *   - ZERO_API_KEY env var set (used as Bearer token for service-account mode)
 *
 * Run with:
 *   set -a; source ../../.env; set +a
 *   node --import tsx --test src/github/routes.integration.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const PAT = process.env.ZERO_GITHUB_TOKEN;
const API_KEY = process.env.ZERO_API_KEY;
const PORT = process.env.ZERO_PORT ?? process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

// The user's own repo to test connect/PR flows against (symulacr/axiom-protocol
// is the reference repo cloned during setup; use the PAT owner's repo instead).
const TEST_OWNER = process.env.ZERO_GITHUB_TEST_OWNER ?? "symulacr";
const TEST_REPO = process.env.ZERO_GITHUB_TEST_REPO ?? "axiom-protocol";

const hasCreds = Boolean(PAT && API_KEY);

(hasCreds ? describe : describe.skip)("GitHub REST endpoints (live server)", { timeout: 30_000 }, () => {
  const headers = {
    "x-api-key": API_KEY!,
    "Authorization": `Bearer ${API_KEY!}`,
    "Content-Type": "application/json",
  };

  let connectedTaskId: string | null = null;

  before(async () => {
    // Verify the server is up
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200, "server must be running");
  });

  it("GET /v1/github/me — returns service account", async () => {
    const res = await fetch(`${BASE}/v1/github/me`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.login, "should have a login");
    assert.ok(body.connectedAt, "should have connectedAt");
  });

  it("GET /v1/github/repos — lists repositories", async () => {
    const res = await fetch(`${BASE}/v1/github/repos`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.repos), "repos should be an array");
    assert.ok(body.repos.length > 0, "should have at least one repo");
    const first = body.repos[0];
    assert.ok(first.name, "repo has name");
    assert.ok(first.fullName, "repo has fullName");
  });

  it("POST /v1/github/connect — connects a repo to a task", async () => {
    const taskId = String(Date.now());
    const res = await fetch(`${BASE}/v1/github/connect`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskId,
        repo: `${TEST_OWNER}/${TEST_REPO}`,
        issueNumber: 1,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, taskId);
    assert.equal(body.repo.owner, TEST_OWNER);
    assert.equal(body.repo.name, TEST_REPO);
    assert.equal(body.issueNumber, 1);
    connectedTaskId = taskId;
  });

  it("GET /v1/github/task/:id/repo — retrieves connected repo", async () => {
    if (!connectedTaskId) return; // skip if connect test didn't run
    const res = await fetch(`${BASE}/v1/github/task/${connectedTaskId}/repo`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.owner, TEST_OWNER);
    assert.equal(body.repo, TEST_REPO);
    assert.equal(body.issueNumber, 1);
  });

  it("POST /v1/github/connect — rejects invalid repo ref", async () => {
    const res = await fetch(`${BASE}/v1/github/connect`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskId: String(Date.now()),
        repo: "not-a-valid-repo-ref",
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error || body.code, "should have error");
  });

  it("POST /v1/github/connect — rejects non-existent repo", async () => {
    const res = await fetch(`${BASE}/v1/github/connect`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskId: String(Date.now()),
        repo: "uuzor/this-repo-does-not-exist-xyz",
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "REPO_NOT_FOUND");
  });

  it("GET /v1/github/task/:id/repo — 404 for unconnected task", async () => {
    const res = await fetch(`${BASE}/v1/github/task/999999999/repo`, { headers });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.code, "NO_REPO_LINKED");
  });

  it("GET /v1/github/me — 401 without Authorization header", async () => {
    const res = await fetch(`${BASE}/v1/github/me`, {
      headers: { "x-api-key": API_KEY! },
    });
    // Without Bearer token, the auth middleware may pass (x-api-key present)
    // but resolveAccount rejects with 400, OR if no x-api-key, auth returns 401.
    assert.ok(res.status === 400 || res.status === 401, `expected 400 or 401, got ${res.status}`);
  });

  it("GET /v1/github/me — 401 without x-api-key", async () => {
    const res = await fetch(`${BASE}/v1/github/me`, {
      headers: { "Authorization": `Bearer ${API_KEY!}` },
    });
    assert.equal(res.status, 401);
  });
});
