import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StorageService } from "../storage/service.js";
import { DaPublisher } from "./publisher.js";
import type { StoredEvent } from "../events/types.js";

function storageService(): StorageService {
  return new StorageService({
    storageRpc: undefined,
    evmRpc: "http://127.0.0.1:8545",
    signerPk: undefined,
  });
}

function event(over: Partial<StoredEvent> = {}): StoredEvent {
  return {
    source: "test",
    chainId: 16602,
    eventName: "WaveOpened",
    blockNumber: 10,
    logIndex: 1,
    txHash: "0x" + "00".repeat(4),
    payload: { programId: "1" },
    receivedAt: Date.now(),
    timestamp: Date.now(),
    ...over,
  };
}

describe("StorageService (in-memory backend)", () => {
  it("stores and retrieves a blob by root hash", async () => {
    const svc = storageService();
    const data = new TextEncoder().encode(JSON.stringify({ hello: "world" }));
    const stored = await svc.upload(data);
    assert.equal(stored.backend, "in-memory");
    assert.match(stored.rootHash, /^0x[0-9a-f]{64}$/i);
    const back = await svc.download(stored.rootHash);
    assert.deepEqual(back, data);
  });

  it("produces deterministic content roots (keccak)", async () => {
    const svc = storageService();
    const data = new TextEncoder().encode("same-bytes");
    const a = await svc.upload(data);
    const b = await svc.upload(data);
    assert.equal(a.rootHash, b.rootHash);
  });
});

describe("DaPublisher", () => {
  it("flushes queued events into a single verifiable batch", async () => {
    const svc = storageService();
    const pub = new DaPublisher(svc, { maxBatchEvents: 100 });
    await pub.enqueue(event({ eventName: "WaveOpened", blockNumber: 10 }));
    await pub.enqueue(event({ eventName: "WaveClosed", blockNumber: 11, logIndex: 2 }));

    const commitment = await pub.flush();
    assert.ok(commitment, "flush should produce a commitment");
    assert.equal(commitment.eventCount, 2);
    assert.match(commitment.batchRoot, /^0x[0-9a-f]{64}$/i);
    assert.equal(commitment.backend, "in-memory");

    // The blob is stored under its 0G content root (rootHash); retrieving it must
    // yield a blob whose embedded batchRoot matches the published commitment.
    const root = commitment.rootHash;
    const raw = await svc.download(root);
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as { batchRoot: string; events: unknown[] };
    assert.equal(parsed.batchRoot, commitment.batchRoot);
    assert.equal(parsed.events.length, 2);
  });

  it("flushes a full batch automatically when the queue size is reached", async () => {
    const svc = storageService();
    const pub = new DaPublisher(svc, { maxBatchEvents: 2 });
    const c1 = await pub.enqueue(event({ eventName: "A" }));
    assert.equal(c1, null, "half-full batch should not flush");
    const c2 = await pub.enqueue(event({ eventName: "B" }));
    assert.ok(c2, "full batch should flush synchronously");
    assert.equal(c2!.eventCount, 2);
    assert.equal(pub.pendingCount, 0);
  });

  it("produces deterministic roots for identical event sets", async () => {
    const makepub = () => {
      const svc = storageService();
      const pub = new DaPublisher(svc, { maxBatchEvents: 10 });
      return pub;
    };
    const enqueueBoth = async (pub: DaPublisher) => {
      await pub.enqueue(event({ eventName: "WaveOpened" }));
      await pub.enqueue(event({ eventName: "WaveClosed", logIndex: 2 }));
      return (await pub.flush())!;
    };
    const a = await enqueueBoth(makepub());
    const b = await enqueueBoth(makepub());
    assert.equal(a.batchRoot, b.batchRoot);
  });
});