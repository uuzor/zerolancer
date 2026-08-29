import { Indexer, KvClient, Batcher, HotRouterClient, ZgFile, EncryptedFile, MerkleTree } from "@0gfoundation/0g-storage-ts-sdk";
import type { EncryptionOption } from "@0gfoundation/0g-storage-ts-sdk";
export { KvClient, Batcher, HotRouterClient, ZgFile, EncryptedFile, MerkleTree, };
import { type Signer } from "ethers";
import type { Hex } from "viem";
interface UploadResult {
    rootHash: Hex;
    txHash: Hex;
    size: number;
}
interface DownloadResult {
    data: Uint8Array;
    rootHash: Hex;
    size: number;
}
export interface StorageAdapter {
    upload(blob: Uint8Array, encryption?: Encryption): Promise<{
        rootHash: Hex;
    }>;
    download(rootHash: Hex): Promise<Uint8Array>;
    markDataHashSeen(rootHash: Hex): void;
    hasSeenDataHash(rootHash: Hex): boolean;
}
export interface ZeroGStorageConfig {
    indexerRpc: string;
    evmRpc: string;
    signer: Signer;
}
export type Encryption = EncryptionOption;
export interface UploadOptions {
    encryption?: Encryption;
    expectedReplica?: number;
    taskSize?: number;
    retryCount?: number;
    retryDelay?: number;
}
export interface DownloadOptions {
    symmetricKey?: Uint8Array;
    privateKey?: Uint8Array | string;
    withProof?: boolean;
}
export interface SeenHashesOptions {
    seenHashesFile?: string;
}
export declare class InMemoryStorage implements StorageAdapter {
    private store;
    private seenDataHashes;
    private readonly seenHashesFile;
    constructor(options?: SeenHashesOptions);
    upload(blob: Uint8Array, _encryption?: Encryption): Promise<{
        rootHash: Hex;
    }>;
    download(rootHash: Hex): Promise<Uint8Array>;
    markDataHashSeen(rootHash: Hex): void;
    hasSeenDataHash(rootHash: Hex): boolean;
}
export declare function uploadToStorage(indexer: Indexer, data: Uint8Array, evmRpc: string, signer: Signer, options?: UploadOptions): Promise<UploadResult>;
export declare function downloadFromStorage(indexer: Indexer, rootHash: Hex, opts?: DownloadOptions): Promise<DownloadResult>;
export declare function createKvClient(indexerRpc: string): KvClient;
export declare class ZeroGStorage implements StorageAdapter {
    readonly indexer: Indexer;
    readonly config: ZeroGStorageConfig;
    private seenDataHashes;
    private readonly seenHashesFile;
    constructor(config: ZeroGStorageConfig, options?: SeenHashesOptions);
    upload(blob: Uint8Array, encryption?: Encryption): Promise<{
        rootHash: Hex;
    }>;
    download(rootHash: Hex): Promise<Uint8Array>;
    markDataHashSeen(rootHash: Hex): void;
    hasSeenDataHash(rootHash: Hex): boolean;
    uploadData(data: Uint8Array, options?: UploadOptions): Promise<UploadResult>;
    downloadWithOpts(rootHash: Hex, opts?: DownloadOptions): Promise<DownloadResult>;
}
//# sourceMappingURL=0g.d.ts.map