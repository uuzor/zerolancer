/**
 * End-to-end integration test: full ZeroLance workflow.
 *
 * Exercises the complete freelancer marketplace lifecycle:
 *   1. Create an on-chain task (calldata for TaskRegistry.createTask)
 *   2. Connect a GitHub repo to the task
 *   3. Create a GitHub issue for the connected task
 *   4. Link a PR to the task
 *   5. Sync PR status (CI checks, merge state)
 *   6. Run AI-verified escrow (verification pipeline + oracle sign)
 *   7. Escrow: approve, deposit, refund (calldata)
 *   8. Dispute: escalate, vote (calldata)
 *   9. Reputation: mint NFT, stake badge (calldata)
 *   10. Clean up: close the created issue
 *
 * Prerequisites:
 *   - Backend server running on ZERO_PORT (default 3000)
 *   - Oracle (TEE signer) running on ZERO_ORACLE_PORT (default 8787)
 *   - Contracts deployed to 0G Galileo testnet
 *   - ZERO_API_KEY, ZERO_GITHUB_TOKEN, ZERO_MOCK_USDC_ADDRESS in .env
 *
 * Run with:
 *   set -a; source ../../.env; set +a
 *   node --import tsx --test src/workflow/full-workflow.integration.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const API_KEY = process.env.ZERO_API_KEY;
const GITHUB_TOKEN = process.env.ZERO_GITHUB_TOKEN;
const USDC = process.env.ZERO_MOCK_USDC_ADDRESS;
const PORT = process.env.ZERO_PORT ?? process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

const REPO = "symulacr/axiom-protocol";
const REPO_OWNER = "symulacr";
const REPO_NAME = "axiom-protocol";
const DEPLOYER = "0x8f5467Da242d12f2471a905536403bfdf5dFA4Ff";

const hasCreds = Boolean(API_KEY && GITHUB_TOKEN && USDC);

(hasCreds ? describe : describe.skip)("Full ZeroLance workflow (end-to-end)", { timeout: 180_000 }, () => {
  const headers = {
    "x-api-key": API_KEY!,
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const testMarker = `[ZeroLance-E2E-${randomBytes(3).toString("hex")}]`;
  const TASK_ID = Math.floor(Math.random() * 100000).toString();
  const SPEC_HASH = "0x" + randomBytes(32).toString("hex");
  let createdIssueNumber: number | null = null;

  before(async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200, "backend must be running");
  });

  // Clean up: close any issue we created
  after(async () => {
    if (!createdIssueNumber) return;
    try {
      await fetch(`${BASE}/v1/github/issues/state`, {
        method: "POST",
        headers,
        body: JSON.stringify({ repo: REPO, number: createdIssueNumber, state: "closed" }),
      });
    } catch {
      // best-effort cleanup
    }
  });

  // ── Step 1: Create on-chain task ──────────────────────────────────────

  it("creates an on-chain task (calldata + nextTaskId)", async () => {
    const res = await fetch(`${BASE}/v1/tasks/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        specHash: SPEC_HASH,
        category: "Code",
        paymentToken: USDC,
        reward: "1000000",
        deadline: "9999999999",
        repoUrl: `https://github.com/${REPO}`,
        issueNumber: 1,
        coverageGateBps: 8000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.ok(body.to);
    assert.ok(body.nextTaskId !== undefined);
  });

  // ── Step 2: Connect GitHub repo to the task ───────────────────────────

  it("connects a GitHub repo to the task", async () => {
    const res = await fetch(`${BASE}/v1/github/connect`, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId: TASK_ID, repo: REPO }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, TASK_ID);
    assert.equal(body.repo.owner, REPO_OWNER);
    assert.equal(body.repo.name, REPO_NAME);
    assert.equal(body.connectedBy, "service-account");
  });

  // ── Step 3: Create a GitHub issue for the task ────────────────────────

  it("creates a GitHub issue for the connected task", async () => {
    const res = await fetch(`${BASE}/v1/github/task/${TASK_ID}/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `${testMarker} E2E workflow test issue`,
        body: "Created by the ZeroLance end-to-end workflow test. Safe to close.",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, TASK_ID);
    assert.ok(body.number > 0);
    assert.equal(body.state, "open");
    assert.equal(body.createdBy, "service-account");
    createdIssueNumber = body.number;
  });

  // ── Step 4: Verify the repo connection includes the issue ─────────────

  it("verifies the repo connection now includes the issue number", async () => {
    const res = await fetch(`${BASE}/v1/github/task/${TASK_ID}/repo`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, TASK_ID);
    assert.equal(body.owner, REPO_OWNER);
    assert.equal(body.repo, REPO_NAME);
    // After creating the issue, it should be linked
    if (createdIssueNumber) {
      assert.equal(body.issueNumber, createdIssueNumber);
    }
  });

  // ── Step 5: Assign freelancer (calldata) ──────────────────────────────

  it("assigns a freelancer to the task (calldata)", async () => {
    const res = await fetch(`${BASE}/v1/tasks/assign`, {
      method: "POST",
      headers,
      body: JSON.stringify({ freelancer: DEPLOYER, taskId: TASK_ID }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  // ── Step 6: Submit deliverable (calldata) ─────────────────────────────

  it("submits a deliverable for verification (calldata + hash)", async () => {
    const res = await fetch(`${BASE}/v1/tasks/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        deliverableRef: `https://github.com/${REPO}/pull/1`,
        prNumber: 1,
        taskId: TASK_ID,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.ok(body.deliverableHash?.startsWith("0x"));
  });

  // ── Step 7: Escrow lifecycle (approve, deposit, status, refund) ──────

  it("encodes ERC20 approve for escrow deposit", async () => {
    const res = await fetch(`${BASE}/v1/escrow/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  it("encodes escrow deposit calldata", async () => {
    const res = await fetch(`${BASE}/v1/escrow/deposit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000", taskId: TASK_ID }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  it("reads on-chain escrow status", async () => {
    const res = await fetch(`${BASE}/v1/escrow/${TASK_ID}`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.escrowed !== undefined);
    assert.equal(typeof body.released, "boolean");
  });

  // ── Step 8: Run AI-verified escrow pipeline ───────────────────────────

  it("runs the AI+CI verification pipeline and gets oracle-signed verdict", async () => {
    const res = await fetch(`${BASE}/v1/verification/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskId: TASK_ID,
        deliverableRef: `https://github.com/${REPO}/pull/1`,
        repoUrl: `https://github.com/${REPO}`,
        prNumber: 1,
        coverageGateBps: 8000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.verdict, "should return verdict");
    assert.equal(body.verdict.taskId, TASK_ID);
    assert.ok(body.verdict.signature?.startsWith("0x"));
    assert.ok(body.verdict.nonce?.startsWith("0x"));
    assert.ok(body.verification?.artifacts?.length > 0);
    assert.ok(body.signer?.startsWith("0x"));
  });

  // ── Step 9: Dispute lifecycle (escalate, vote) ────────────────────────

  it("encodes dispute escalation calldata", async () => {
    const res = await fetch(`${BASE}/v1/disputes/escalate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ arbiters: [DEPLOYER], taskId: TASK_ID }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  it("encodes dispute vote calldata", async () => {
    const res = await fetch(`${BASE}/v1/disputes/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ choice: "Freelancer", taskId: TASK_ID }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  // ── Step 10: Reputation lifecycle (mint, stake) ───────────────────────

  it("encodes reputation NFT mint calldata", async () => {
    const res = await fetch(`${BASE}/v1/reputation/mint`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dataDescription: `${testMarker} Task completion`,
        dataHash: "0x" + "b".repeat(64),
        taskId: TASK_ID,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  it("encodes verified badge stake calldata", async () => {
    const res = await fetch(`${BASE}/v1/reputation/stake`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000000000000000", tokenId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
  });

  // ── Step 11: Clean up — close the created issue ───────────────────────

  it("closes the created GitHub issue (cleanup)", async () => {
    if (!createdIssueNumber) {
      console.warn("Skipping — no issue was created");
      return;
    }
    const res = await fetch(`${BASE}/v1/github/issues/state`, {
      method: "POST",
      headers,
      body: JSON.stringify({ repo: REPO, number: createdIssueNumber, state: "closed" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.state, "closed");
  });
});
