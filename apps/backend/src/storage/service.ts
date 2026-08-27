import { Wallet } from "ethers";
import type { Hex } from "viem";
import { keccak256 } from "ethers";
import type { StorageAdapter, Encryption } from "@zerolance/config/storage/0g";
import { ZeroGStorage, InMemoryStorage } from "@zerolance/config/storage/0g";
import { resolveStorageRpc } from "@zerolance/config";
import { createLogger } from "../utils/logger.js";

const log = createLogger("storage");

export interface StorageServiceConfig {
  /// 0G Storage indexer RPC (turbo node). Falls back to the per-chain default.
  storageRpc?: string;
  /// EVM RPC used to settle 0G Storage transactions.
  evmRpc: string;
  /// Signer used to authorize 0G Storage uploads.
  signerPk?: string;
}

export interface StoredBlob {
  rootHash: Hex;
  txHash: Hex | null;
  size: number;
  backend: "0g" | "in-memory";
}

/// StorageService uploads artifacts (specs, diffs, AI results) to 0G Storage.
/// When no signer/storage RPC is configured it falls back to an in-memory
/// adapter (deterministic keccak addressable) so local dev stays usable.
export class StorageService {
  readonly adapter: StorageAdapter;
  readonly backend: "0g" | "in-memory";
  private uploads = 0;

  constructor(cfg: StorageServiceConfig) {
    const signerPk = cfg.signerPk;
    const storageRpc = cfg.storageRpc ?? resolveStorageRpc();
    if (signerPk && storageRpc) {
      this.adapter = new ZeroGStorage({
        indexerRpc: storageRpc,
        evmRpc: cfg.evmRpc,
        signer: new Wallet(signerPk),
      });
      this.backend = "0g";
      log.info("StorageService using 0G Storage", { storageRpc });
    } else {
      this.adapter = new InMemoryStorage();
      this.backend = "in-memory";
      log.warn("StorageService using in-memory fallback (no 0G storage config)");
    }
  }

  async upload(
    data: Uint8Array,
    encryption?: Encryption,
    kind = "blob",
  ): Promise<StoredBlob> {
    const { rootHash } = await this.adapter.upload(data, encryption);
    this.uploads += 1;
    const result: StoredBlob = {
      rootHash,
      txHash: null,
      size: data.length,
      backend: this.backend,
    };
    log.info("stored blob", { kind, rootHash, size: data.length, backend: this.backend });
    return result;
  }

  async download(rootHash: Hex): Promise<Uint8Array> {
    return this.adapter.download(rootHash);
  }

  /// Upload a JSON-serializable value (auto-serialized to UTF-8 bytes).
  async uploadJson(value: unknown, encryption?: Encryption): Promise<StoredBlob> {
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    return this.upload(encoded, encryption, "json");
  }

  /// Deterministic content addressing used for in-memory fallback parity.
  static hashOf(data: Uint8Array): Hex {
    return keccak256(data) as Hex;
  }

  get stats(): { backend: "0g" | "in-memory"; uploads: number } {
    return { backend: this.backend, uploads: this.uploads };
  }
}