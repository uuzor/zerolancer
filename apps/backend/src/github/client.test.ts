import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  parseRepoRef,
  repoUrl,
  safeGithubError,
} from "./client.js";
import { verifyWebhookSignature, getGithubStore } from "./store.js";

test("parseRepoRef: parses https GitHub URL", () => {
  const ref = parseRepoRef("https://github.com/openhands/zerolancer");
  assert.equal(ref?.owner, "openhands");
  assert.equal(ref?.repo, "zerolancer");
});

test("parseRepoRef: parses SSH clone URL", () => {
  const ref = parseRepoRef("git@github.com:acme/widgets.git");
  assert.equal(ref?.owner, "acme");
  assert.equal(ref?.repo, "widgets");
});

test("parseRepoRef: parses owner/repo shorthand", () => {
  const ref = parseRepoRef("acme/widgets");
  assert.equal(ref?.owner, "acme");
  assert.equal(ref?.repo, "widgets");
});

test("parseRepoRef: returns null for garbage", () => {
  assert.equal(parseRepoRef("not-a-repo"), null);
  assert.equal(parseRepoRef(""), null);
});

test("repoUrl: builds canonical URL", () => {
  assert.equal(repoUrl("acme", "widgets"), "https://github.com/acme/widgets");
});

test("safeGithubError: maps 404 message", () => {
  const err = safeGithubError(new Error("GitHub 404: /repos/x/y"));
  assert.match(err.message, /not found/);
});

test("safeGithubError: preserves non-404 errors", () => {
  const orig = new Error("rate limited");
  const err = safeGithubError(orig);
  assert.equal(err.message, "rate limited");
});

test("GithubStore: OAuth state lifecycle", () => {
  const store = getGithubStore();
  const state = store.createOAuthState("/dashboard");
  assert.ok(state.length > 0);
  const consumed = store.consumeOAuthState(state);
  assert.equal(consumed.ok, true);
  assert.equal(consumed.redirect, "/dashboard");
  // second consume fails (single-use)
  const reused = store.consumeOAuthState(state);
  assert.equal(reused.ok, false);
});

test("GithubStore: repo connection + PR link", () => {
  const store = getGithubStore();
  const taskId = 9999n;
  store.connectRepo({
    taskId,
    owner: "acme",
    repo: "widgets",
    issueNumber: 42,
    connectedBy: "alice",
    connectedAt: new Date().toISOString(),
    prNumber: null,
    prBranch: null,
  });
  const conn = store.getConnection(taskId);
  assert.ok(conn);
  assert.equal(conn?.owner, "acme");
  assert.equal(conn?.repo, "widgets");

  store.setPr(taskId, 7, "feature/x");
  const updated = store.getConnection(taskId);
  assert.equal(updated?.prNumber, 7);
  assert.equal(updated?.prBranch, "feature/x");

  assert.ok(store.removeConnection(taskId));
  assert.equal(store.getConnection(taskId), undefined);
});

test("verifyWebhookSignature: valid HMAC", () => {
  const payload = JSON.stringify({ action: "opened", number: 1 });
  const secret = "webhook-secret";
  const sig = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(verifyWebhookSignature(payload, sig, secret), true);
});

test("verifyWebhookSignature: rejects bad signature", () => {
  assert.equal(verifyWebhookSignature("{}", "sha256=deadbeef", "secret"), false);
  assert.equal(verifyWebhookSignature("{}", "invalid", "secret"), false);
});
