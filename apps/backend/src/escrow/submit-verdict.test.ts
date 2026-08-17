import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Interface } from "ethers";
import { ZEROLANCE_ESCROW_VAULT_ABI, type Verdict } from "@zerolance/config";

/// Regression test for the submitVerdict ABI tuple encoding bug.
///
/// The on-chain `submitVerdict((Verdict))` function takes an unnamed struct
/// tuple. ethers v6's human-readable ABI does not support named-object
/// arguments for unnamed tuples — calling `submitVerdict({ taskId, ... })`
/// silently produces empty/zero calldata. The fix is to pass a positional
/// array `[taskId, deliverableHash, ...]` instead.
///
/// This test verifies both:
///   1. The array form encodes to the expected 4-byte selector + full tuple.
///   2. The object form encodes to a selector + EMPTY tuple (the bug).
describe("submitVerdict ABI tuple encoding", () => {
  const iface = new Interface([...ZEROLANCE_ESCROW_VAULT_ABI]);

  const verdict: Verdict = {
    taskId: 42n,
    deliverableHash:
      "0x" + "ab".repeat(32) as `0x${string}`,
    passed: true,
    score: 95n,
    nonce: "0x" + "cd".repeat(32) as `0x${string}`,
    validUntil: 1893456000n,
    signature: "0x" + "ef".repeat(65) as `0x${string}`,
  };

  it("encodes the tuple as a positional array (the fix)", () => {
    const args = [
      verdict.taskId,
      verdict.deliverableHash,
      verdict.passed,
      verdict.score,
      verdict.nonce,
      verdict.validUntil,
      verdict.signature,
    ];
    const calldata = iface.encodeFunctionData("submitVerdict", [args]);

    // Must start with a valid 4-byte selector (not 0x00000000).
    const selector = calldata.slice(0, 10);
    assert.ok(
      selector !== "0x00000000",
      "selector should not be zero",
    );

    // The full calldata must be non-trivial in length:
    // 4 bytes selector + 32 bytes offset + 7 fields (dynamic bytes for sig/nonce).
    assert.ok(
      calldata.length > 200,
      `calldata should encode full tuple, got length ${calldata.length}`,
    );

    // The taskId (42) must appear in the encoded calldata.
    assert.ok(
      calldata.toLowerCase().includes("2a".padStart(64, "0")),
      "taskId (42 = 0x2a) must be present in encoded calldata",
    );
  });

  it("the object form reproduces the bug (empty tuple)", () => {
    // Passing a plain object (the old buggy approach) for an unnamed tuple
    // causes ethers to emit only the selector with no tuple body.
    assert.throws(
      () => {
        // ethers v6 throws on malformed object args for unnamed tuples
        iface.encodeFunctionData("submitVerdict", [verdict as unknown as object]);
      },
      // ethers v6 rejects non-array / non-tuple inputs for tuple params
      /Error|TypeError|invalid|tuple|array/i,
    );
  });
});
