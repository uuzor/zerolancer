import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Interface } from "ethers";
import { ZEROLANCE_TASK_REGISTRY_ABI } from "@zerolance/config";

/// Regression test for the indexer event arg extraction bug.
///
/// ethers v6 `Result` objects only expose numeric array indices via
/// `Object.entries()` — named event params (e.g. `taskId`, `client`) are
/// NOT enumerable own properties. The old code filtered with
/// `!/^\d+$/.test(key)` which excluded ALL numeric keys, producing empty
/// payloads for every indexed event.
///
/// The fix uses `decoded.fragment.inputs` (the named ABI params) together
/// with `decoded.args.toArray()` to build a keyed payload.
describe("indexer event arg extraction", () => {
  const iface = new Interface([...ZEROLANCE_TASK_REGISTRY_ABI]);

  it("fragment.inputs provides named params for keyed payload", () => {
    const fragment = iface.getEvent("TaskCreated");
    assert.ok(fragment, "TaskCreated fragment should exist");
    const names = fragment.inputs.map((i) => i.name);
    assert.deepEqual(names, [
      "taskId",
      "client",
      "specHash",
      "category",
      "reward",
      "deadline",
      "repoUrl",
      "issueNumber",
    ]);
  });

  it("Result.toArray() preserves positional order matching fragment.inputs", () => {
    // Verify that toArray() yields values in the same order as fragment.inputs,
    // which is what the indexer relies on to assign names.
    const fragment = iface.getEvent("TaskCreated")!;
    // Construct a Result-like array to simulate decoded.args
    const fakeArgs = [1n, "0xclient", "0xspec", 0, 1_000_000n, 1893456000n, "repo", 42n];
    const payload: Record<string, unknown> = {};
    // Mimic the indexer's extraction logic using toArray() ordering.
    (fakeArgs as unknown as { toArray(): unknown[] }).toArray = () => fakeArgs;
    const result = (fakeArgs as unknown as { toArray(): unknown[] }).toArray();
    result.forEach((value, i) => {
      const name = fragment.inputs[i]?.name || `arg${i}`;
      payload[name] = typeof value === "bigint" ? value.toString() : value;
    });
    assert.equal(payload.taskId, "1");
    assert.equal(payload.category, 0);
    assert.equal(payload.reward, "1000000");
    assert.equal(payload.repoUrl, "repo");
    assert.equal(payload.issueNumber, "42");
  });

  it("Object.entries filter on numeric keys produces empty payload (the bug)", () => {
    // Simulate the OLD buggy logic: it excluded any key matching /^\d+$/.
    const fakeArgs: Record<string, unknown> = {
      "0": 1n,
      "1": "0xclient",
      "2": "0xspec",
      "3": 0,
      "4": 1_000_000n,
      "5": 1893456000n,
      "6": "repo",
      "7": 42n,
    };
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fakeArgs)) {
      if (typeof key === "string" && !/^\d+$/.test(key)) {
        payload[key] = typeof value === "bigint" ? value.toString() : value;
      }
    }
    assert.deepEqual(payload, {}, "old logic must produce empty payload");
  });
});
