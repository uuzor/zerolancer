import { Indexer, MemData, KvClient, Batcher, HotRouterClient, ZgFile, EncryptedFile, MerkleTree, } from "@0gfoundation/0g-storage-ts-sdk";
export { KvClient, Batcher, HotRouterClient, ZgFile, EncryptedFile, MerkleTree, };
import { keccak256 } from "ethers";
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync, } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
const ORACLE_SEEN_HASHES_FILE = join(process.env.ZERO_DATA_DIR ?? process.cwd(), ".data", "oracle-seen-hashes.json");
function loadSeenDataHashes(file) {
    try {
        if (!existsSync(file))
            return new Set();
        const raw = readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed ||
            typeof parsed !== "object" ||
            !Array.isArray(parsed.seenDataHashes)) {
            throw new Error("oracle seen-hashes file root is missing a string array");
        }
        const seen = new Set();
        for (const item of parsed.seenDataHashes) {
            if (typeof item === "string")
                seen.add(item.toLowerCase());
        }
        return seen;
    }
    catch {
        if (existsSync(file)) {
            try {
                renameSync(file, `${file}.bak`);
            }
            catch {
                /* ignore — backup is best-effort */
            }
        }
        return new Set();
    }
}
function persistSeenDataHashes(file, seen) {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ seenDataHashes: [...seen] }));
    renameSync(tmp, file);
}
/// In-memory storage for devnet (no 0G Storage network needed). Mirrors axiom.
export class InMemoryStorage {
    store = new Map();
    seenDataHashes;
    seenHashesFile;
    constructor(options = {}) {
        this.seenHashesFile = options.seenHashesFile ?? ORACLE_SEEN_HASHES_FILE;
        this.seenDataHashes = loadSeenDataHashes(this.seenHashesFile);
    }
    async upload(blob, _encryption) {
        const rootHash = keccak256(blob);
        this.store.set(rootHash.toLowerCase(), new Uint8Array(blob));
        return { rootHash };
    }
    async download(rootHash) {
        const blob = this.store.get(rootHash.toLowerCase());
        if (!blob)
            throw new Error(`Blob not found: ${rootHash}`);
        return new Uint8Array(blob);
    }
    markDataHashSeen(rootHash) {
        const hash = rootHash.toLowerCase();
        if (this.seenDataHashes.has(hash))
            return;
        this.seenDataHashes.add(hash);
        persistSeenDataHashes(this.seenHashesFile, this.seenDataHashes);
    }
    hasSeenDataHash(rootHash) {
        return this.seenDataHashes.has(rootHash.toLowerCase());
    }
}
export async function uploadToStorage(indexer, data, evmRpc, signer, options = {}) {
    const memData = new MemData(data);
    const uploadOpts = {
        expectedReplica: options.expectedReplica,
        taskSize: options.taskSize,
        encryption: options.encryption,
    };
    const [tx, err] = await indexer.upload(memData, evmRpc, signer, uploadOpts);
    if (err)
        throw new Error(`0G upload failed: ${err.message ?? String(err)}`);
    const result = tx;
    if (!result.rootHash)
        throw new Error("SDK upload returned unexpected format");
    return {
        rootHash: result.rootHash,
        txHash: result.txHash,
        size: data.length,
    };
}
export async function downloadFromStorage(indexer, rootHash, opts = {}) {
    const downloadOpts = {
        proof: opts.withProof ?? true,
    };
    if (opts.symmetricKey || opts.privateKey) {
        downloadOpts.decryption = {
            ...(opts.symmetricKey ? { symmetricKey: opts.symmetricKey } : {}),
            ...(opts.privateKey ? { privateKey: opts.privateKey } : {}),
        };
    }
    const [blob, err] = await indexer.downloadToBlob(rootHash, downloadOpts);
    if (err)
        throw new Error(`0G download failed: ${err.message ?? String(err)}`);
    if (!blob)
        throw new Error(`0G Storage download returned no blob for ${rootHash}`);
    const data = new Uint8Array(await blob.arrayBuffer());
    return { data, rootHash, size: data.length };
}
export function createKvClient(indexerRpc) {
    return new KvClient(indexerRpc);
}
/// 0G Storage adapter (production). Mirrors axiom's ZeroGStorage.
export class ZeroGStorage {
    indexer;
    config;
    seenDataHashes;
    seenHashesFile;
    constructor(config, options = {}) {
        this.config = config;
        this.indexer = new Indexer(config.indexerRpc);
        this.seenHashesFile = options.seenHashesFile ?? ORACLE_SEEN_HASHES_FILE;
        this.seenDataHashes = loadSeenDataHashes(this.seenHashesFile);
    }
    async upload(blob, encryption) {
        const result = await uploadToStorage(this.indexer, blob, this.config.evmRpc, this.config.signer, { encryption });
        return { rootHash: result.rootHash };
    }
    async download(rootHash) {
        const result = await downloadFromStorage(this.indexer, rootHash, {
            withProof: false,
        });
        return result.data;
    }
    markDataHashSeen(rootHash) {
        const hash = rootHash.toLowerCase();
        if (this.seenDataHashes.has(hash))
            return;
        this.seenDataHashes.add(hash);
        persistSeenDataHashes(this.seenHashesFile, this.seenDataHashes);
    }
    hasSeenDataHash(rootHash) {
        return this.seenDataHashes.has(rootHash.toLowerCase());
    }
    async uploadData(data, options = {}) {
        return uploadToStorage(this.indexer, data, this.config.evmRpc, this.config.signer, options);
    }
    async downloadWithOpts(rootHash, opts = {}) {
        return downloadFromStorage(this.indexer, rootHash, opts);
    }
}
//# sourceMappingURL=0g.js.map