import { createLogger } from "../utils/logger.js";
import { DEFAULT_EVENT_LIMIT, bigintReplacer } from "@zerolance/config";
import { extractErrorMessage } from "../utils/response.js";
import type { StoredEventPayload } from "./payloads.js";
import type { StoredEvent, StoredEventInput, TaskEventQuery } from "./types.js";
import { broadcast } from "../ws/broadcaster.js";
import {
  existsSync,
  readFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

const log = createLogger("events");

const byBlockThenLogReceived = (a: StoredEvent, b: StoredEvent) =>
  a.blockNumber - b.blockNumber ||
  a.logIndex - b.logIndex ||
  a.receivedAt - b.receivedAt;

function dedupeKey(
  evt: Pick<StoredEventInput, "chainId" | "txHash" | "logIndex">,
): string {
  return `${evt.chainId}:${evt.txHash}:${evt.logIndex}`;
}

function tokenIdFromPayload(payload: StoredEventPayload): string | null {
  const record = payload as Record<string, unknown>;
  for (const key of ["taskId", "tokenId", "agentTokenId"] as const) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw === "bigint") return raw.toString();
    if (typeof raw === "number" && Number.isFinite(raw))
      return BigInt(raw).toString();
    if (typeof raw === "string") {
      try {
        return BigInt(raw).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/// In-memory event store with persisted JSON snapshot + WS broadcast.
/// Ring-buffered per (source,eventName) bucket; indexed by eventName and taskId.
/// Adapted from axiom-protocol's EventStore.
export class EventStore {
  private readonly cap: number;
  private readonly buckets: Map<string, StoredEvent[]>;
  private readonly byEventName: Map<string, StoredEvent[]>;
  private readonly byTaskId: Map<string, StoredEvent[]>;
  private readonly seenKeys = new Set<string>();
  private readonly dirty = new Set<string>();
  private total: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(maxEventsPerSource: number = DEFAULT_EVENT_LIMIT) {
    if (!Number.isInteger(maxEventsPerSource) || maxEventsPerSource <= 0) {
      throw new Error(`maxEventsPerSource must be a positive integer`);
    }
    this.cap = maxEventsPerSource;
    this.buckets = new Map();
    this.byEventName = new Map();
    this.byTaskId = new Map();
    this.total = 0;
    this.load();
  }

  append(evt: StoredEventInput): StoredEvent {
    const dedupe = dedupeKey(evt);
    const stored: StoredEvent = {
      ...evt,
      payload: { ...evt.payload },
      receivedAt: evt.receivedAt ?? Date.now(),
      timestamp: Date.now(),
    };
    const bucketKey = `${stored.source}::${stored.eventName}`;
    let bucket = this.buckets.get(bucketKey);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(bucketKey, bucket);
    }
    if (bucket.length >= this.cap) {
      const evicted = bucket.shift()!;
      this.seenKeys.delete(dedupeKey(evicted));
      if (this.total > 0) this.total -= 1;
    }
    bucket.push(stored);
    this.seenKeys.add(dedupe);
    this.addToEventNameIndex(stored);
    const tid = tokenIdFromPayload(stored.payload);
    if (tid !== null) this.addToTaskIdIndex(tid, stored);
    this.dirty.add(bucketKey);
    this.total += 1;
    this.persistDebounced();
    try {
      broadcast(stored.eventName, stored);
    } catch {
      /* WS errors are non-fatal */
    }
    return stored;
  }

  queryByTask(query: TaskEventQuery): readonly StoredEvent[] {
    const target = BigInt(query.taskId).toString();
    const bucket = this.byTaskId.get(target);
    if (bucket === undefined) return [];
    const matches: StoredEvent[] = [];
    for (const evt of bucket) {
      if (query.eventName !== undefined && evt.eventName !== query.eventName)
        continue;
      if (query.source !== undefined && evt.source !== query.source) continue;
      matches.push(evt);
    }
    matches.sort(byBlockThenLogReceived);
    return query.limit !== undefined ? matches.slice(0, query.limit) : matches;
  }

  getAll(
    limit?: number,
    since?: number,
    eventName?: string,
  ): readonly StoredEvent[] {
    if (eventName !== undefined) {
      const bucket = this.byEventName.get(eventName);
      if (!bucket) return [];
      if (!since) return [...bucket];
      return bucket.filter((e) => e.timestamp > since);
    }
    const all: StoredEvent[] = [];
    for (const bucket of this.buckets.values()) all.push(...bucket);
    let results = all;
    if (since !== undefined) results = results.filter((e) => e.timestamp > since);
    results.sort(byBlockThenLogReceived);
    return limit !== undefined ? results.slice(0, limit) : results;
  }

  get size(): number {
    let n = 0;
    for (const bucket of this.buckets.values()) n += bucket.length;
    return n;
  }

  private addToEventNameIndex(evt: StoredEvent): void {
    let bucket = this.byEventName.get(evt.eventName);
    if (!bucket) {
      bucket = [];
      this.byEventName.set(evt.eventName, bucket);
    }
    bucket.push(evt);
  }

  private addToTaskIdIndex(taskId: string, evt: StoredEvent): void {
    let bucket = this.byTaskId.get(taskId);
    if (!bucket) {
      bucket = [];
      this.byTaskId.set(taskId, bucket);
    }
    bucket.push(evt);
  }

  // ── Persistence (debounced JSON snapshot) ───────────────────────────────────
  private load(): void {
    const rawBuckets = loadBuckets();
    this.buckets.clear();
    this.byEventName.clear();
    this.byTaskId.clear();
    this.seenKeys.clear();
    this.total = 0;
    for (const [bucketKey, events] of rawBuckets) {
      this.buckets.set(bucketKey, events as StoredEvent[]);
      this.total += (events as StoredEvent[]).length;
      for (const evt of events as StoredEvent[]) {
        this.seenKeys.add(dedupeKey(evt));
        this.addToEventNameIndex(evt);
        const tid = tokenIdFromPayload(evt.payload);
        if (tid !== null) this.addToTaskIdIndex(tid, evt);
      }
    }
  }

  private enqueuePersist(): Promise<void> {
    this.persistChain = this.persistChain
      .then(() => saveBuckets(this.buckets, this.dirty))
      .catch((err) => {
        log.warn("persist failed", { error: extractErrorMessage(err) });
      });
    return this.persistChain;
  }

  private persistDebounced(): void {
    if (this.dirty.size === 0) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.enqueuePersist();
    }, 2_000);
  }

  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const key of this.buckets.keys()) this.dirty.add(key);
    await this.enqueuePersist();
  }
}

const PERSIST_DIR = join(process.env.ZERO_DATA_DIR ?? process.cwd(), ".data");
export const PERSIST_FILE = join(PERSIST_DIR, "events.json");

export function loadBuckets(): Map<string, unknown[]> {
  try {
    if (!existsSync(PERSIST_FILE)) return new Map();
    const raw = readFileSync(PERSIST_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("persist file root is not an object");
    }
    const buckets = new Map<string, unknown[]>();
    for (const [bucketKey, events] of Object.entries(parsed)) {
      if (Array.isArray(events)) buckets.set(bucketKey, events);
    }
    return buckets;
  } catch (err) {
    log.warn("persist file corrupt or unreadable, starting fresh", {
      error: extractErrorMessage(err),
    });
    if (existsSync(PERSIST_FILE)) {
      try {
        renameSync(PERSIST_FILE, `${PERSIST_FILE}.bak`);
      } catch {
        /* ignore */
      }
    }
    return new Map();
  }
}

export async function saveBuckets(
  buckets: Map<string, unknown[]>,
  dirty: Set<string>,
): Promise<void> {
  await mkdir(PERSIST_DIR, { recursive: true });
  const parts: string[] = [];
  for (const [key, events] of buckets) {
    if (dirty.has(key)) {
      parts.push(`${JSON.stringify(key)}:${JSON.stringify(events, bigintReplacer)}`);
    } else {
      parts.push(`${JSON.stringify(key)}:${JSON.stringify(events, bigintReplacer)}`);
    }
  }
  dirty.clear();
  const data = `{${parts.join(",")}}`;
  const tmp = `${PERSIST_FILE}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, PERSIST_FILE);
}

let singleton: EventStore | undefined;
export function getEventStore(): EventStore {
  if (!singleton) singleton = new EventStore();
  return singleton;
}

/// Test helper: drop the singleton (tests that construct a fresh store).
export function resetEventStoreForTests(): void {
  singleton = undefined;
}
