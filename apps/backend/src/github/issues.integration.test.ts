/**
 * HTTP-level integration tests for GitHub issue lifecycle endpoints.
 *
 * Tests the full issue lifecycle:
 *   list issues → create issue → get issue → close issue → verify closed
 *   + create issue for a connected task
 *
 * Prerequisites:
 *   - Backend server running on ZERO_PORT (default 3000)
 *   - ZERO_API_KEY and ZERO_GITHUB_TOKEN set in .env (PAT with repo scope)
 *   - PAT user must have write access to the target repo (or use own repo)
 *
 * NOTE: These tests create real GitHub issues. They are cleaned up (closed) at the end.
 * A unique title prefix is used so issues can be identified if cleanup fails.
 *
 * Run with:
 *   set -a; source ../../.env; set +a
 *   node --import tsx --test src/github/issues.integration.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const API_KEY = process.env.ZERO_API_KEY;
const GITHUB_TOKEN = process.env.ZERO_GITHUB_TOKEN;
const PORT = process.env.ZERO_PORT ?? process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

// Use the PAT owner's repo or the symulacr/axiom-protocol repo (collaborator access)
const REPO = "symulacr/axiom-protocol";
const REPO_OWNER = "symulacr";
const REPO_NAME = "axiom-protocol";

const hasCreds = Boolean(API_KEY && GITHUB_TOKEN);

(hasCreds ? describe : describe.skip)("GitHub issue lifecycle (live server)", { timeout: 60_000 }, () => {
  const headers = {
    "x-api-key": API_KEY!,
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  // Unique marker for test issues so they can be identified/cleaned up
  const testMarker = `[ZeroLance-Test-${randomBytes(3).toString("hex")}]`;
  let createdIssueNumber: number | null = null;

  before(async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200, "backend must be running");
  });

  // ── List issues ───────────────────────────────────────────────────────

  it("GET /v1/github/issues — lists open issues for a repo", async () => {
    const url = new URL(`${BASE}/v1/github/issues`);
    url.searchParams.set("owner", REPO_OWNER);
    url.searchParams.set("repo", REPO_NAME);
    url.searchParams.set("state", "open");
    const res = await fetch(url, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.issues), "issues should be an array");
    // Each issue should have required fields
    for (const issue of body.issues) {
      assert.ok(issue.number, "issue should have number");
      assert.ok(issue.title, "issue should have title");
      assert.ok(issue.state, "issue should have state");
      assert.ok(issue.htmlUrl, "issue should have htmlUrl");
    }
  });

  it("GET /v1/github/issues — 400 without owner/repo", async () => {
    const res = await fetch(`${BASE}/v1/github/issues`, { headers });
    assert.ok(res.status >= 400, `expected 4xx, got ${res.status}`);
  });

  it("GET /v1/github/issues — 401 without auth", async () => {
    const url = new URL(`${BASE}/v1/github/issues`);
    url.searchParams.set("owner", REPO_OWNER);
    url.searchParams.set("repo", REPO_NAME);
    const res = await fetch(url);
    assert.equal(res.status, 401);
  });

  // ── Create issue ─────────────────────────────────────────────────────

  it("POST /v1/github/issues/create — creates a GitHub issue", async () => {
    const res = await fetch(`${BASE}/v1/github/issues/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        repo: REPO,
        title: `${testMarker} Issue lifecycle test`,
        body: "This issue was created by the ZeroLance backend integration test. It will be closed automatically.",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.number > 0, "should return issue number");
    assert.equal(body.title, `${testMarker} Issue lifecycle test`);
    assert.equal(body.state, "open");
    assert.ok(body.htmlUrl, "should return html URL");
    assert.equal(body.repo.owner, REPO_OWNER);
    assert.equal(body.repo.name, REPO_NAME);
    assert.equal(body.createdBy, "service-account");
    createdIssueNumber = body.number;
  });

  it("POST /v1/github/issues/create — rejects invalid repo", async () => {
    const res = await fetch(`${BASE}/v1/github/issues/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        repo: "not-a-valid-repo-reference",
        title: "Should fail",
      }),
    });
    assert.ok(res.status >= 400, `expected 4xx, got ${res.status}`);
  });

  // ── Get issue ────────────────────────────────────────────────────────

  it("GET /v1/github/issues/get — retrieves the created issue", async () => {
    if (!createdIssueNumber) {
      console.warn("Skipping — no issue created");
      return;
    }
    const url = new URL(`${BASE}/v1/github/issues/get`);
    url.searchParams.set("owner", REPO_OWNER);
    url.searchParams.set("repo", REPO_NAME);
    url.searchParams.set("number", String(createdIssueNumber));
    const res = await fetch(url, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.issue.number, createdIssueNumber);
    assert.equal(body.issue.state, "open");
    assert.ok(body.issue.htmlUrl);
  });

  // ── Close issue ──────────────────────────────────────────────────────

  it("POST /v1/github/issues/state — closes the created issue", async () => {
    if (!createdIssueNumber) {
      console.warn("Skipping — no issue created");
      return;
    }
    const res = await fetch(`${BASE}/v1/github/issues/state`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        repo: REPO,
        number: createdIssueNumber,
        state: "closed",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.number, createdIssueNumber);
    assert.equal(body.state, "closed");
    assert.equal(body.updatedBy, "service-account");
  });

  it("GET /v1/github/issues/get — confirms issue is now closed", async () => {
    if (!createdIssueNumber) {
      console.warn("Skipping — no issue created");
      return;
    }
    const url = new URL(`${BASE}/v1/github/issues/get`);
    url.searchParams.set("owner", REPO_OWNER);
    url.searchParams.set("repo", REPO_NAME);
    url.searchParams.set("number", String(createdIssueNumber));
    const res = await fetch(url, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.issue.state, "closed");
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("POST /v1/github/issues/create — 401 without auth", async () => {
    const res = await fetch(`${BASE}/v1/github/issues/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo: REPO,
        title: "Should not be created",
      }),
    });
    assert.equal(res.status, 401);
  });
});
