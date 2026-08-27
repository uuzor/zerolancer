import type { Hex } from "viem";
import { keccak256 } from "ethers";
import type { StorageService } from "../storage/service.js";
import type { StoredEvent } from "../events/types.js";
import { createLogger } from "../utils/logger.js";
import { bigintReplacer } from "@zerolance/config";

const log = createLogger("da");

export interface DaCommitment {
  /// Verifiable merkle-style root over the batch's event leaves.
  batchRoot: Hex;
  /// 0G Storage content root — the key used to retrieve the collated blob.
  rootHash: Hex;
  blockNumber: number;
  txHash: Hex | null;
  backend: "0g" | "in-memory";
  eventCount: number;
  persistedAt: number;
}

export interface DaPublisherOptions {
  maxBatchEvents?: number;
  flushIntervalMs?: number;
}

/// DA publisher: batches new app-level events (ingested via the EventStore)
/// and anchors each batch as a single content-addressed blob on 0G Storage,
/// producing a verifiable `batchRoot` commitment. Consumers can later fetch the
/// blob by rootHash and recompute the merkle-ish root (keccak over (eventName,
/// payload)) to verify events were included at anchor time.
///
/// NOTE: this repo installs `@0gfoundation/0g-storage-ts-sdk` (KV/indexer +
/// blob upload) but not the `0g-da-node` client. Anchoring on 0G Storage treats
/// blobs as the verifiable, compressing DA layer; swap for the native DA SDK
/// with zero interface change by implementing `DaBackend.publishBlob`.
export class DaPublisher {
  private pending: StoredEvent[] = [];
  private commitments: DaCommitment[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly maxBatchEvents: number;
  private readonly flushIntervalMs: number;

  constructor(
    private readonly storage: StorageService,
    private readonly opts: DaPublisherOptions = {},
  ) {
    this.maxBatchEvents = opts.maxBatchEvents ?? 50;
    this.flushIntervalMs = opts.flushIntervalMs ?? 5_000;
  }

  /// Queue an event for the next DA batch. Returns the pending commitment if a
  /// batch was flushed synchronously (i.e. it reached the max size), else null.
  async enqueue(evt: StoredEvent): Promise<DaCommitment | null> {
    this.pending.push(evt);
    if (this.pending.length >= this.maxBatchEvents) {
      return this.flush();
    }
    return null;
  }

  /// Anchor pending events as a single 0G Storage blob. No-op if nothing queued.
  async flush(): Promise<DaCommitment | null> {
    if (this.pending.length === 0) return null;
    const batch = [...this.pending];
    this.pending = [];
    try {
      const commitment = await this.anchor(batch);
      this.commitments.push(commitment);
      log.info("DA batch anchored", {
        batchRoot: commitment.batchRoot,
        eventCount: batch.length,
        backend: commitment.backend,
      });
      return commitment;
    } catch (err) {
      // Re-queue on transient failure so no event is dropped.
      this.pending.unshift(...batch);
      throw err;
    }
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush().catch((err) => {
        log.warn("background DA flush failed", { error: String(err) });
      });
    }, this.flushIntervalMs);
    // Don't keep the process alive on the timer alone.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get recentCommitments(): readonly DaCommitment[] {
    return this.commitments;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  private async anchor(batch: StoredEvent[]): Promise<DaCommitment> {
    const normalized = batch.map((e) => ({
      source: e.source,
      chainId: e.chainId,
      eventName: e.eventName,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      txHash: e.txHash,
      payload: e.payload,
      receivedAt: e.receivedAt,
    }));
    // Batch is a set of (eventName, payload) leaves. Encode deterministically.
    const leaves: Hex[] = normalized.map((e) =>
      (keccak256(
        new TextEncoder().encode(
          `${e.eventName}::${JSON.stringify(e.payload, bigintReplacer)}`,
        ),
      ) as Hex),
    );
    const batchRoot = this.pairwiseRoot(leaves);
    const blob = new TextEncoder().encode(
      JSON.stringify({ batchRoot, events: normalized }, bigintReplacer),
    );
    const stored = await this.storage.upload(blob, undefined, "da-batch");
    return {
      batchRoot,
      rootHash: stored.rootHash,
      blockNumber: Math.max(...batch.map((e) => e.blockNumber), 0),
      txHash: stored.txHash,
      backend: stored.backend,
      eventCount: batch.length,
      persistedAt: Date.now(),
    };
  }

  /// Deterministic binary-merkle-style root over sorted leaf hashes. This is a
  /// simple, reproducible commitment (not a full incremental merkle tree).
  private pairwiseRoot(leaves: Hex[]): Hex {
    const sorted = [...leaves].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    if (sorted.length === 0) return ("0x" + "00".repeat(32)) as Hex;
    // Each level is a list of 32-byte node hashes (hex `0x` + 64 chars).
    let level = sorted;
    while (level.length > 1) {
      const next: Hex[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i]!;
        const right = i + 1 < level.length ? level[i + 1]! : left;
        // Duplicate the final odd node to keep a full binary tree.
        next.push(keccak256((left + right.slice(2)) as `0x${string}`) as Hex);
      }
      level = next;
    }
    return level[0]!;
  }
}