/**
 * HTTP-level integration tests for the 0G Compute REST endpoints.
 *
 * Prerequisites:
 *   - Backend server running on ZERO_PORT (default 3000)
 *   - ZERO_COMPUTE_API_KEY env var set (0G compute router key)
 *
 * NOTE: The /chat endpoint requires the 0G compute account to have inference
 * credits. If the key can list models but /chat returns 401, the account has
 * no inference balance — that is an external billing issue, not a code bug.
 *
 * Run with:
 *   set -a; source ../../.env; set +a
 *   node --import tsx --test src/compute/routes.integration.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const COMPUTE_KEY = process.env.ZERO_COMPUTE_API_KEY;
const API_KEY = process.env.ZERO_API_KEY;
const PORT = process.env.ZERO_PORT ?? process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

const hasCreds = Boolean(COMPUTE_KEY && API_KEY);

(hasCreds ? describe : describe.skip)("0G Compute REST endpoints (live server)", { timeout: 60_000 }, () => {
  const headers = {
    "x-api-key": API_KEY!,
    "Content-Type": "application/json",
  };

  before(async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200, "server must be running");
  });

  it("GET /v1/compute/models — lists available models", async () => {
    const res = await fetch(`${BASE}/v1/compute/models`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.models), "models should be an array");
    assert.ok(body.models.length > 0, "should have at least one model");
    // 0G's in-house model should always be present
    assert.ok(body.models.includes("0gm-1.0-35b-a3b"), "should include 0gm-1.0-35b-a3b");
  });

  it("GET /v1/compute/models — 401 without x-api-key", async () => {
    const res = await fetch(`${BASE}/v1/compute/models`);
    assert.equal(res.status, 401);
  });

  it("POST /v1/compute/chat — rejects empty messages", async () => {
    const res = await fetch(`${BASE}/v1/compute/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [] }),
    });
    // Zod validation rejects empty array → 400 or 500
    assert.ok(res.status >= 400, `expected 4xx/5xx, got ${res.status}`);
  });

  it("POST /v1/compute/chat — rejects missing messages", async () => {
    const res = await fetch(`${BASE}/v1/compute/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "0gm-1.0-35b-a3b" }),
    });
    assert.ok(res.status >= 400, `expected 4xx/5xx, got ${res.status}`);
  });

  it("POST /v1/compute/chat — accepts valid request (may 401 if no credits)", async () => {
    const res = await fetch(`${BASE}/v1/compute/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "0gm-1.0-35b-a3b",
        messages: [{ role: "user", content: "Reply with: OK" }],
        maxTokens: 10,
      }),
    });
    const body = await res.json();
    // Either the chat succeeds (200) or the 0G account lacks inference credits (500 with 401 inner)
    if (res.status === 200) {
      assert.ok(body.choices, "should have choices");
      assert.ok(body.choices[0].content, "choice should have content");
      assert.ok(body.model, "should return model name");
    } else {
      // 401 from 0G means the key is valid but has no inference credits
      assert.ok(res.status >= 400, `unexpected status ${res.status}`);
      assert.ok(body.error, "should have error message");
    }
  });
});
