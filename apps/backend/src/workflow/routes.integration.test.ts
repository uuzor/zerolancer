/**
 * HTTP-level integration tests for the smart contract workflow endpoints.
 *
 * Tests the full escrow lifecycle:
 *   task create → assign → submit → escrow approve/deposit/refund →
 *   verification (AI+CI pipeline) → dispute escalate/vote → reputation mint/stake
 *
 * Prerequisites:
 *   - Backend server running on ZERO_PORT (default 3000)
 *   - Oracle (TEE signer) running on ZERO_ORACLE_PORT (default 8787)
 *   - Contracts deployed to 0G Galileo testnet (chain ID 16602)
 *   - ZERO_EVM_RPC pointing to https://evmrpc-testnet.0g.ai
 *   - ZERO_API_KEY and ZERO_MOCK_USDC_ADDRESS set in .env
 *
 * Run with:
 *   set -a; source ../../.env; set +a
 *   node --import tsx --test src/workflow/routes.integration.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const API_KEY = process.env.ZERO_API_KEY;
const USDC = process.env.ZERO_MOCK_USDC_ADDRESS;
const DEPLOYER = "0x8f5467Da242d12f2471a905536403bfdf5dFA4Ff";
const PORT = process.env.ZERO_PORT ?? process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

const hasCreds = Boolean(API_KEY && USDC);

(hasCreds ? describe : describe.skip)("Smart contract workflow (live server)", { timeout: 120_000 }, () => {
  const headers = {
    "x-api-key": API_KEY!,
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const SPEC_HASH = "0x" + randomBytes(32).toString("hex");
  const REPO_URL = "https://github.com/symulacr/axiom-protocol";
  const DELIVERABLE_REF = `${REPO_URL}/pull/1`;

  before(async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200, "backend must be running");
  });

  // ── Task lifecycle ────────────────────────────────────────────────────

  it("POST /v1/tasks/create — encodes createTask calldata + returns nextTaskId", async () => {
    const res = await fetch(`${BASE}/v1/tasks/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        specHash: SPEC_HASH,
        category: "Code",
        paymentToken: USDC,
        reward: "1000000",
        deadline: "9999999999",
        repoUrl: REPO_URL,
        issueNumber: 1,
        coverageGateBps: 8000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"), "calldata should be hex");
    assert.ok(body.to, "should return target contract address");
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_TASK_REGISTRY_ADDRESS ?? "").toLowerCase());
    assert.ok(body.nextTaskId !== undefined, "should return nextTaskId");
  });

  it("POST /v1/tasks/create — rejects invalid category", async () => {
    const res = await fetch(`${BASE}/v1/tasks/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        specHash: SPEC_HASH,
        category: "Invalid",
        paymentToken: USDC,
        reward: "1000000",
        deadline: "9999999999",
        repoUrl: REPO_URL,
        issueNumber: 1,
      }),
    });
    assert.ok(res.status >= 400, `expected 4xx, got ${res.status}`);
  });

  it("POST /v1/tasks/assign — encodes assignTask calldata", async () => {
    const res = await fetch(`${BASE}/v1/tasks/assign`, {
      method: "POST",
      headers,
      body: JSON.stringify({ freelancer: DEPLOYER, taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.ok(body.to, "should return target address");
  });

  it("POST /v1/tasks/submit — encodes submitDeliverable + returns deliverableHash", async () => {
    const res = await fetch(`${BASE}/v1/tasks/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ deliverableRef: DELIVERABLE_REF, prNumber: 1, taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.ok(body.deliverableHash?.startsWith("0x"), "should return deliverable hash");
    assert.equal(body.deliverableHash.length, 66, "hash should be 32 bytes");
  });

  // ── Escrow ───────────────────────────────────────────────────────────

  it("POST /v1/escrow/approve — encodes ERC20 approve calldata", async () => {
    const res = await fetch(`${BASE}/v1/escrow/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_MOCK_USDC_ADDRESS ?? "").toLowerCase());
  });

  it("POST /v1/escrow/deposit — encodes deposit calldata", async () => {
    const res = await fetch(`${BASE}/v1/escrow/deposit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000", taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_ESCROW_VAULT_ADDRESS ?? "").toLowerCase());
  });

  it("GET /v1/escrow/:id — reads on-chain escrow status", async () => {
    const res = await fetch(`${BASE}/v1/escrow/0`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, "0");
    assert.ok(body.escrowed !== undefined, "should return escrowed amount");
    assert.equal(typeof body.released, "boolean");
  });

  it("POST /v1/escrow/refund — encodes refund calldata", async () => {
    const res = await fetch(`${BASE}/v1/escrow/refund`, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_ESCROW_VAULT_ADDRESS ?? "").toLowerCase());
  });

  // ── Verification (AI + CI pipeline) ──────────────────────────────────

  it("POST /v1/verification/verify — runs AI+CI pipeline, oracle signs verdict", async () => {
    const res = await fetch(`${BASE}/v1/verification/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        taskId: 0,
        deliverableRef: DELIVERABLE_REF,
        repoUrl: REPO_URL,
        prNumber: 1,
        coverageGateBps: 8000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    // Verdict struct
    assert.ok(body.verdict, "should return verdict");
    assert.equal(body.verdict.taskId, "0");
    assert.ok(body.verdict.deliverableHash?.startsWith("0x"));
    assert.equal(typeof body.verdict.passed, "boolean");
    assert.ok(body.verdict.score !== undefined);
    assert.ok(body.verdict.nonce?.startsWith("0x"), "nonce should be hex");
    assert.ok(body.verdict.validUntil !== undefined);
    assert.ok(body.verdict.signature?.startsWith("0x"), "signature should be hex");
    // Verification details
    assert.ok(body.verification, "should return verification details");
    assert.ok(Array.isArray(body.verification.artifacts), "should have artifacts array");
    assert.ok(body.verification.artifacts.length > 0, "should have at least one artifact");
    // Oracle signer
    assert.ok(body.signer?.startsWith("0x"), "should return oracle signer address");
    assert.equal(body.signer.toLowerCase(), (process.env.ZERO_TEE_SIGNER_ADDRESS ?? "").toLowerCase(),
      "signer should match oracle's TEE signer");
  });

  // ── Disputes ──────────────────────────────────────────────────────────

  it("POST /v1/disputes/escalate — encodes escalateDispute calldata", async () => {
    const res = await fetch(`${BASE}/v1/disputes/escalate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ arbiters: [DEPLOYER], taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_ESCROW_VAULT_ADDRESS ?? "").toLowerCase());
  });

  it("POST /v1/disputes/vote — encodes vote calldata", async () => {
    const res = await fetch(`${BASE}/v1/disputes/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ choice: "Freelancer", taskId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_ARBITRATION_ADDRESS ?? "").toLowerCase());
  });

  it("GET /v1/disputes/:id — returns dispute events for a task", async () => {
    const res = await fetch(`${BASE}/v1/disputes/0`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, "0");
    assert.ok(Array.isArray(body.events), "should return events array");
  });

  // ── Reputation ───────────────────────────────────────────────────────

  it("POST /v1/reputation/mint — encodes mintReputationForTask calldata", async () => {
    const res = await fetch(`${BASE}/v1/reputation/mint`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dataDescription: "ZeroLance Task #0 completion",
        dataHash: "0x" + "a".repeat(64),
        taskId: 0,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_ESCROW_VAULT_ADDRESS ?? "").toLowerCase());
  });

  it("POST /v1/reputation/stake — encodes stakeVerifiedBadge calldata", async () => {
    const res = await fetch(`${BASE}/v1/reputation/stake`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: "1000000000000000000", tokenId: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.calldata?.startsWith("0x"));
    assert.equal(body.to.toLowerCase(), (process.env.ZERO_REPUTATION_NFT_ADDRESS ?? "").toLowerCase());
  });

  it("GET /v1/reputation/:id — returns reputation NFTs for a task", async () => {
    const res = await fetch(`${BASE}/v1/reputation/0`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.taskId, "0");
    assert.ok(Array.isArray(body.nfts), "should return nfts array");
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("all endpoints — 401 without x-api-key", async () => {
    const res = await fetch(`${BASE}/v1/tasks/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specHash: SPEC_HASH,
        category: "Code",
        paymentToken: USDC,
        reward: "1000000",
        deadline: "9999999999",
        repoUrl: REPO_URL,
        issueNumber: 1,
      }),
    });
    assert.equal(res.status, 401);
  });
});
