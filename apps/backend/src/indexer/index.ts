import type { Contract, EventLog, JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import { createLogger } from "../utils/logger.js";
import { getEventStore } from "../events/store.js";
import { extractErrorMessage } from "../utils/response.js";

const log = createLogger("indexer");

export interface IndexerConfig {
  contract: Contract;
  source: string;
  provider: JsonRpcProvider;
  chainId: number;
  pollWindowBlocks: number;
  startBlock?: number;
  pollIntervalMs?: number;
}

/// Block-range event poller (adapted from axiom-protocol). Polls the chain at
/// a fixed cadence, decodes logs into the EventStore, and broadcasts via WS.
export class Indexer {
  private polling = false;
  private lastBlock: number;
  private readonly pollIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cfg: IndexerConfig) {
    this.lastBlock = cfg.startBlock ?? 0;
    this.pollIntervalMs = cfg.pollIntervalMs ?? 4_000;
  }

  async start(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    if (this.lastBlock === 0) {
      this.lastBlock = await this.cfg.provider.getBlockNumber().catch(() => 0);
      log.info("indexer starting at current block", {
        block: this.lastBlock,
        source: this.cfg.source,
      });
    }
    await this.poll();
    this.timer = setInterval(() => {
      void this.poll().catch((err) => {
        log.warn("poll error", { error: extractErrorMessage(err) });
      });
    }, this.pollIntervalMs);
  }

  stop(): void {
    this.polling = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.polling) return;
    const current = await this.cfg.provider.getBlockNumber().catch(() => {
      return this.lastBlock;
    });
    if (current <= this.lastBlock) return;
    const from = this.lastBlock + 1;
    const to = Math.min(current, from + this.cfg.pollWindowBlocks - 1);
    try {
      const events = (await this.cfg.contract.queryFilter(
        "*",
        from,
        to,
      )) as EventLog[];
      const store = getEventStore();
      for (const evt of events) {
        const decoded = this.cfg.contract.interface.parseLog(evt);
        const eventName = decoded?.name ?? "Unknown";
        const payload: Record<string, unknown> = {};
        if (decoded) {
          for (const [key, value] of Object.entries(decoded.args)) {
            if (typeof key === "string" && !/^\d+$/.test(key)) {
              payload[key] = typeof value === "bigint" ? value.toString() : value;
            }
          }
        }
        store.append({
          source: this.cfg.source,
          chainId: this.cfg.chainId,
          blockNumber: evt.blockNumber,
          txHash: (evt.transactionHash as Hex | null) ?? null,
          logIndex: evt.index,
          eventName,
          payload,
        });
      }
      if (events.length > 0) {
        log.debug("indexed events", {
          count: events.length,
          from,
          to,
          source: this.cfg.source,
        });
      }
    } catch (err) {
      log.warn("queryFilter failed", {
        error: extractErrorMessage(err),
        from,
        to,
      });
    }
    this.lastBlock = to;
  }
}
